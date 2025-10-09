import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS so other devices/browsers can call your API
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
  const HOST = '0.0.0.0';
  await app.listen(PORT, HOST);

  console.log(`🚀 API on http://${HOST}:${PORT} (LAN reachable)`);
}
bootstrap();