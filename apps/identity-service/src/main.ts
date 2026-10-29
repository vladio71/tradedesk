import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { configureApp, loadEnvFile } from '@tradedesk/common';
import { AppModule } from './app.module';
import { loadIdentityConfig } from './config';

async function bootstrap(): Promise<void> {
  loadEnvFile();
  const config = loadIdentityConfig();
  const app = await NestFactory.create(AppModule);
  configureApp(app, { globalPrefix: 'api/identity', title: 'TradeDesk Identity Service' });
  await app.listen(config.port);
}

void bootstrap();
