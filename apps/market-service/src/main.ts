import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { configureApp, loadEnvFile } from '@tradedesk/common';
import { AppModule } from './app.module';
import { loadMarketConfig } from './config';

async function bootstrap(): Promise<void> {
  loadEnvFile();
  const config = loadMarketConfig();
  const app = await NestFactory.create(AppModule);
  configureApp(app, { globalPrefix: 'api/market', title: 'TradeDesk Market Service' });
  await app.listen(config.port);
}

void bootstrap();
