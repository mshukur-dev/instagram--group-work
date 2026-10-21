import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  // rawBody: LiveKit webhooks are verified against the raw request body
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(AppConfigService);

  app.setGlobalPrefix('api');
  app.set('trust proxy', 1); // real client IP behind Next.js proxy / Render
  app.use(cookieParser());
  // REST normally comes through the Next.js proxy (same origin);
  // CORS is for the direct Socket.IO connection and local tools.
  app.enableCors({ origin: config.get('WEB_URL'), credentials: true });
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('Instagram API')
    .setDescription('REST API. Full contract: docs/spec/api.md')
    .addBearerAuth()
    .addCookieAuth('access_token')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger), {
    swaggerOptions: { persistAuthorization: true, withCredentials: true },
  });

  const port = config.get('PORT');
  await app.listen(port);
  Logger.log(`API: http://localhost:${port}/api · Swagger: http://localhost:${port}/api/docs`);
}

void bootstrap();
