import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; // Для доступа к переменным окружения

// Интерфейсы, соответствующие тем, что используются в Angular и для Gemini
interface AngularChatMessage {
  role: string;
  content: string;
}

interface GeminiMessagePart {
  text: string;
}

interface GeminiMessage {
  role: string;
  parts: GeminiMessagePart[];
}

interface GeminiRequestBody {
  contents: GeminiMessage[];
  systemInstruction?: {
    parts: GeminiMessagePart[];
  };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

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
      parts: [{ text: msg.content }]
    }));
  }

  async getGeminiResponse(
    angularMessages: AngularChatMessage[],
  ): Promise<AngularChatMessage> {
    const geminiFormattedMessages =
      this.mapMessagesToGeminiFormat(angularMessages);

    const systemInstruction = {
      role: 'system', // Техническая роль
      parts: [
        {
          text: `
        You are the Dungeon Master in a text-based, fantasy RPG.
        Be patient to player and especially at the very beginning of the new game, help him create his hero and ask him more details about it, his stats, abilities and inventory. If you see, that he is newcomer and can not set details by himself, offer him to do it for him, and if he agree, set details, that he was not able to answer.
        Your task is to describe the world vividly and colorfully, role-play non-player characters (NPCs), react fairly to player actions, and follow the plot. Never break character.
        Address the players formally (using 'you'). Your tone should be mysterious yet fair. Do not generate your response in Markdown format.`,
        },
      ],
    };

    const requestBody: GeminiRequestBody = {
      contents: geminiFormattedMessages,
      systemInstruction: {
        parts: systemInstruction.parts,
      },
      generationConfig: { temperature: 0.75, maxOutputTokens: 2000 },
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
        let errorMessage = `AI service request failed (Status: ${response.status}).`;
        try {
          const parsedError = JSON.parse(errorBody);
          errorMessage = parsedError.error?.message || errorMessage;
        } catch (e) {
          /* Не удалось распарсить ошибку как JSON */
        }

        throw new HttpException(
          {
            status: response.status,
            error: errorMessage,
            details: errorBody, // Можно добавить детали
          },
          response.status,
        );
      }

      const geminiData = (await response.json()) as any; // Используем any для гибкости, но лучше определить тип ответа Gemini
      this.logger.log('Received response from Gemini API.');
      // this.logger.debug(`Response data: ${JSON.stringify(geminiData)}`); // Для отладки

      let assistantContent = "Sorry, I couldn't understand the AI's response.";
      if (
        geminiData.candidates &&
        geminiData.candidates.length > 0 &&
        geminiData.candidates[0].content &&
        geminiData.candidates[0].content.parts &&
        geminiData.candidates[0].content.parts.length > 0 &&
        geminiData.candidates[0].content.parts[0].text
      ) {
        assistantContent = geminiData.candidates[0].content.parts[0].text;
      } else if (
        geminiData.promptFeedback &&
        geminiData.promptFeedback.blockReason
      ) {
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

      return { role: 'assistant', content: assistantContent };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // Перебрасываем HttpException
      }
      this.logger.error('Critical error during Gemini API call:', error);
      throw new HttpException(
        'An internal error occurred while contacting the AI service.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
