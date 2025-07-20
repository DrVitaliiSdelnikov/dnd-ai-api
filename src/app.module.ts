import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ChatModule } from './chat/chat.module';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { SummarizeModule } from './summarize/summarize.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ChatModule,
    SummarizeModule,
  ],
  controllers: [AppController, ChatController],
  providers: [AppService, ChatService],
})
export class AppModule {}
