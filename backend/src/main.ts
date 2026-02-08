import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('Backend baslatiliyor...');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Backend calisiyor: http://localhost:${port}/api/v1`);
}
bootstrap();
