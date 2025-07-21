import {
  AngularChatMessage,
  GeminiMessage,
  GeminiRequestBody,
} from '../chat/chat.model';
import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { TASK_SUMMARIZE_HISTORY } from '../prompts/prompts';
import { ConfigService } from '@nestjs/config';
import { AiModelName, AiParams, getGeminiApiUrl } from '../const/ai';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

@Injectable()
export class SummarizeService {
  private readonly geminiApiUrl: string;
  private readonly googleApiKey: string;
  private readonly logger = new Logger(SummarizeService.name);

  constructor(private readonly configService: ConfigService) {
    this.googleApiKey = this.configService.get<string>('GOOGLE_API_KEY');
    if (!this.googleApiKey) {
      this.logger.error('GOOGLE_API_KEY is not defined!');
      throw new Error('Configuration error: GOOGLE_API_KEY is missing.');
    }
    this.geminiApiUrl = getGeminiApiUrl(this.googleApiKey);
  }

  async getSummaryFromGemini(
    lastMessages: AngularChatMessage[],
    existingSummary: string,
    retries = 3,
  ): Promise<string> {
    const messagesForSummary = [
      { role: 'system', content: existingSummary || 'No previous summary.' },
      ...lastMessages,
    ];
    const geminiFormattedMessages =
      this.mapMessagesToGeminiFormat(messagesForSummary);

    const systemInstruction = {
      role: 'system',
      parts: [{ text: TASK_SUMMARIZE_HISTORY }],
    };

    const requestBody: GeminiRequestBody = {
      contents: geminiFormattedMessages,
      systemInstruction: { parts: systemInstruction.parts },
      generationConfig: {
        temperature: AiParams.temperature,
        maxOutputTokens: AiParams.maxOutputTokens,
      },
    };

    try {
      this.logger.log(
        `Sending request to Gemini API for summarization. Retries left: ${retries}`,
      );
      const response = await fetch(this.geminiApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `Error from Gemini API on summary (Status: ${response.status}): ${errorBody}`,
        );

        if (
          (response.status === 429 || response.status >= 500) &&
          retries > 0
        ) {
          const waitTime = Math.pow(2, 3 - retries) * 1000;
          this.logger.warn(
            `Rate limit/server error on summary. Retrying in ${waitTime}ms...`,
          );
          await delay(waitTime);
          return this.getSummaryFromGemini(
            lastMessages,
            existingSummary,
            retries - 1,
          );
        }

        throw new HttpException(
          `Failed to generate summary (Status: ${response.status})`,
          response.status,
        );
      }

      const geminiData = (await response.json()) as any;

      if (geminiData.promptFeedback?.blockReason) {
        this.logger.warn(
          `Summarization blocked. Reason: ${geminiData.promptFeedback.blockReason}`,
        );
        return `[Summarization was blocked by the safety filter: ${geminiData.promptFeedback.blockReason}]`;
      }

      if (geminiData.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
        this.logger.warn('Summarization stopped due to MAX_TOKENS.');
      }

      if (geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
        return geminiData.candidates[0].content.parts[0].text;
      } else {
        this.logger.warn(
          'Could not generate summary, received empty response from AI.',
        );
        return existingSummary;
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Critical error in getSummaryFromGemini:', error);
      throw new BadGatewayException(
        'Failed to contact AI service for summarization.',
      );
    }
  }

  private mapMessagesToGeminiFormat(
    angularMessages: AngularChatMessage[],
  ): GeminiMessage[] {
    return angularMessages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
  }
}
