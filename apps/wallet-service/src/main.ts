import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { configureApp, loadEnvFile } from '@tradedesk/common';
import { loadWalletConfig } from './config';

async function bootstrap(): Promise<void> {
  loadEnvFile();
  const config = loadWalletConfig();
  // AppModule is imported after the .env file is loaded, because it reads NODE_ENV when it is evaluated.
  const { AppModule } = await import('./app.module');
  // rawBody is needed to verify the webhook signature over the exact bytes that were sent.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app, { globalPrefix: 'api/wallet', title: 'TradeDesk Wallet Service' });
  await app.listen(config.port);
}

void bootstrap();
