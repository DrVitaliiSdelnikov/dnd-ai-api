import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SummarizeService } from './summarize.service';

@Controller('summarize')
export class SummarizeController {
  constructor(private readonly summarizeService: SummarizeService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async getSummary(
    @Body() body: SummarizeRequestBody,
  ): Promise<AngularChatMessage> {
    if (!body.messages || !Array.isArray(body.messages)) {
      throw new Error('Request body must include a "messages" array.');
    }
    const summaryText = await this.summarizeService.getSummaryFromGemini(
      body.messages,
      body.existingSummary,
    );

    return {
      role: 'assistant',
      content: summaryText,
    };
  }
}
