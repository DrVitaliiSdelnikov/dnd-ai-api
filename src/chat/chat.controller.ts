import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ChatService } from './chat.service';

interface AngularChatMessage {
  role: string;
  content: string;
}

interface AngularRequestBody {
  messages: AngularChatMessage[];
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async sendMessageToGemini(
    @Body() body: AngularRequestBody,
  ): Promise<AngularChatMessage> {
    if (
      !body.messages ||
      !Array.isArray(body.messages) ||
      body.messages.length === 0
    ) {
      throw new Error(
        'Request body must include a non-empty "messages" array.',
      );
    }
    return this.chatService.getGeminiResponse(body.messages);
  }
}
