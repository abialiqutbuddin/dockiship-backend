import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // CORS so other devices/browsers can call your API
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Serve uploaded files statically
  const uploadDir = join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadDir));

  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
  const HOST = '0.0.0.0';
  await app.listen(PORT, HOST);

  console.log(`API on http://${HOST}:${PORT} (LAN reachable)`);
}
bootstrap();
