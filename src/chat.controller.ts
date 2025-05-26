import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ChatService } from './chat.service';

interface AngularChatMessage {
  role: string;
  content: string;
}

interface AngularRequestBody {
  messages: AngularChatMessage[];
}

@Controller('chat') // Маршрут будет /chat
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @HttpCode(HttpStatus.OK) // По умолчанию POST возвращает 201, но для чата 200 лучше
  async sendMessageToGemini(
    @Body() body: AngularRequestBody,
  ): Promise<AngularChatMessage> {
    // Валидацию тела запроса можно добавить с помощью @nestjs/class-validator
    if (
      !body.messages ||
      !Array.isArray(body.messages) ||
      body.messages.length === 0
    ) {
      // В реальном приложении лучше использовать ValidationPipe
      throw new Error(
        'Request body must include a non-empty "messages" array.',
      );
    }
    return this.chatService.getGeminiResponse(body.messages);
  }
}
