import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('NEST_PORT') || 3000;

  app.enableCors({
    origin: [
      'http://localhost:4200',
      'https://dnd-ai.pages.dev',
      'https://rpg-play-ai.com',
      'https://app.rpg-play-ai.com'
      // 'http://127.0.0.1:8788', // Если будешь обращаться с wrangler
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}`,
    'Bootstrap',
  );
}
bootstrap();
