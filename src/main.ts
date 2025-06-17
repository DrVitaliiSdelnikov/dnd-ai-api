import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('NEST_PORT') || 3000;

  const allowedOrigins = [
    'http://localhost:4200',
    'https://rpg-play-ai.com',
    'https://app.rpg-play-ai.com',
  ];

  app.enableCors({
    // 👇 ЗАМЕНЯЕМ СТАТИЧЕСКИЙ МАССИВ НА ФУНКЦИЮ
    origin: (origin, callback) => {
      // Разрешаем запросы, у которых нет origin (например, Postman, мобильные приложения)
      if (!origin) {
        return callback(null, true);
      }

      // Разрешаем все наши статические домены
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // ✨ ГЛАВНОЕ РЕШЕНИЕ: Разрешаем любой поддомен dnd-ai.pages.dev
      if (origin.endsWith('.dnd-ai.pages.dev')) {
        return callback(null, true);
      }

      // Если ни одно из условий не выполнено, запрещаем запрос
      callback(new Error('Not allowed by CORS'));
    },
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
