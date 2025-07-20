import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AI_AS_MASTER_GENERAL_INSTRUCTION,
  NOT_JSON_RESPONSE_ERROR_INSTRUCTION,
} from '../prompts/prompts';
import {
  AngularChatMessage,
  GeminiMessage,
  GeminiRequestBody,
} from './chat.model';
import { AiParams } from '../const/ai';

export const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly googleApiKey: string;
  private readonly geminiApiUrl: string;

  constructor(private configService: ConfigService) {
    this.googleApiKey = this.configService.get<string>('GOOGLE_API_KEY');
    if (!this.googleApiKey) {
      this.logger.error(
        'GOOGLE_API_KEY is not defined in environment variables!',
      );
      throw new Error('Configuration error: GOOGLE_API_KEY is missing.');
    }
    const modelName = 'gemini-2.5-flash-preview-05-20';
    this.geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.googleApiKey}`;
  }

  private mapMessagesToGeminiFormat(
    angularMessages: AngularChatMessage[],
  ): GeminiMessage[] {
    return angularMessages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
  }

  async getGeminiResponse(
    angularMessages: AngularChatMessage[],
    retries = 3,
    isCorrectionAttempt = false,
  ): Promise<AngularChatMessage> {
    if (isCorrectionAttempt) {
      const correctionInstruction: AngularChatMessage = {
        role: 'user',
        content: NOT_JSON_RESPONSE_ERROR_INSTRUCTION,
      };
      angularMessages.push(correctionInstruction);
    }

    const geminiFormattedMessages = this.mapMessagesToGeminiFormat(angularMessages);

    const systemInstruction = {
      role: 'system',
      parts: [
        {
          text: AI_AS_MASTER_GENERAL_INSTRUCTION,
        },
      ],
    };

    const requestBody: GeminiRequestBody = {
      contents: geminiFormattedMessages,
      systemInstruction: {
        parts: systemInstruction.parts,
      },
      generationConfig: { temperature: AiParams.temperature, maxOutputTokens: AiParams.maxOutputTokens },
    };

    this.logger.log(`Sending request to Gemini API: ${this.geminiApiUrl}`);

    try {
      const response = await fetch(this.geminiApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `Error from Gemini API (Status: ${response.status}): ${errorBody}`,
        );

        if (
          (response.status === 429 || response.status >= 500) &&
          retries > 0
        ) {
          const waitTime = Math.pow(2, 3 - retries) * 1000;
          this.logger.warn(
            `Rate limit or server error. Retrying in ${waitTime}ms... (${retries} retries left)`,
          );
          await delay(waitTime);
          return this.getGeminiResponse(angularMessages, retries - 1, false);
        }

        let errorMessage = `AI service request failed (Status: ${response.status}).`;
        try {
          const parsedError = JSON.parse(errorBody);
          errorMessage = parsedError.error?.message || errorMessage;
        } catch (e) {}

        if (response.status >= 500) {
          throw new BadGatewayException({
            message: 'The AI service is currently unavailable.',
            upstreamError: errorMessage,
          });
        }

        throw new HttpException(
          {
            status: response.status,
            error: errorMessage,
            details: errorBody,
          },
          response.status,
        );
      }

      const geminiData = (await response.json()) as any;
      this.logger.log('Received response from Gemini API.');

      let assistantContent = "Sorry, I couldn't understand the AI's response.";
      let rawContent: string | null = null;
      let isBlocked = false;

      if (
        geminiData.candidates &&
        geminiData.candidates.length > 0 &&
        geminiData.candidates[0].content &&
        geminiData.candidates[0].content.parts &&
        geminiData.candidates[0].content.parts.length > 0 &&
        geminiData.candidates[0].content.parts[0].text
      ) {
        rawContent = geminiData.candidates[0].content.parts[0].text;
        assistantContent = geminiData.candidates[0].content.parts[0].text;
      } else if (
        geminiData.promptFeedback &&
        geminiData.promptFeedback.blockReason
      ) {
        isBlocked = true;
        assistantContent = `My response was blocked. Reason: ${geminiData.promptFeedback.blockReason}.`;
        this.logger.warn(
          'Gemini API response blocked:',
          geminiData.promptFeedback,
        );
      } else {
        this.logger.warn(
          'Unexpected response structure from Gemini API:',
          geminiData,
        );
      }

      if (isBlocked) {
        return {
          role: 'assistant',
          content: `My response was blocked. Reason: ${assistantContent}.`
        };
      }

      try {
        JSON.parse(rawContent);
        this.logger.log('AI response is a valid JSON.');
        return { role: 'assistant', content: rawContent };
      } catch (parsingError) {
        this.logger.warn(`
        Failed to parse AI response as JSON. Raw response: "${rawContent}"
        `);

        if (retries > 0) {
          this.logger.warn(`
          Retrying with a correction instruction... (${retries} retries left)
          `);
          await delay(1000);
          return this.getGeminiResponse(angularMessages, retries - 1, true);
        } else {
          this.logger.error(`
            Failed to get a valid JSON response from AI after multiple retries.
          `);
          return {
            role: 'assistant',
            content: `
            Sorry, I'm having trouble formatting my response right now. 
            Please try again in a moment.
            `,
          };
        }
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Critical error during Gemini API call:', error);
      throw new HttpException(
        'An internal error occurred while contacting the AI service.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
