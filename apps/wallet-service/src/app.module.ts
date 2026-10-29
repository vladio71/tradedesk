import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@tradedesk/common';
import { DataSource } from 'typeorm';
import { CreateTransferUseCase } from './application/create-transfer.use-case';
import { GetMyWalletUseCase } from './application/get-my-wallet.use-case';
import { GetVolumeReportUseCase } from './application/get-volume-report.use-case';
import { HandleCryptoWebhookUseCase } from './application/handle-crypto-webhook.use-case';
import { GetDepositUseCase, ListDepositsUseCase } from './application/list-deposits.use-case';
import { ListLedgerUseCase } from './application/list-ledger.use-case';
import { GetTransferUseCase, ListTransfersUseCase } from './application/list-transfers.use-case';
import { RequestDepositUseCase } from './application/request-deposit.use-case';
import { SimulateDepositUseCase } from './application/simulate-deposit.use-case';
import { loadWalletConfig } from './config';
import { CRYPTO_PROVIDER, WEBHOOK_DELIVERY, WEBHOOK_SIGNER } from './domain/ports';
import { UNIT_OF_WORK } from './domain/unit-of-work';
import { buildTypeOrmOptions } from './infrastructure/database';
import { FakeCryptoProvider } from './infrastructure/fake-crypto-provider';
import { HmacWebhookSigner } from './infrastructure/hmac-webhook-signer';
import { HttpWebhookDelivery } from './infrastructure/http-webhook-delivery';
import { TypeOrmUnitOfWork } from './infrastructure/typeorm-unit-of-work';
import { DepositsController } from './interfaces/http/deposits.controller';
import { DevController } from './interfaces/http/dev.controller';
import { HealthController } from './interfaces/http/health.controller';
import { ReportsController } from './interfaces/http/reports.controller';
import { TransfersController } from './interfaces/http/transfers.controller';
import { WalletsController } from './interfaces/http/wallets.controller';
import { WebhooksController } from './interfaces/http/webhooks.controller';

// The dev controller exists only outside production. In production the route simply does not exist.
const devControllers = process.env.NODE_ENV === 'production' ? [] : [DevController];

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forRootAsync({ useFactory: () => buildTypeOrmOptions(loadWalletConfig().databaseUrl) }),
  ],
  controllers: [
    WalletsController,
    DepositsController,
    WebhooksController,
    TransfersController,
    ReportsController,
    HealthController,
    ...devControllers,
  ],
  providers: [
    GetMyWalletUseCase,
    ListLedgerUseCase,
    RequestDepositUseCase,
    ListDepositsUseCase,
    GetDepositUseCase,
    HandleCryptoWebhookUseCase,
    SimulateDepositUseCase,
    CreateTransferUseCase,
    ListTransfersUseCase,
    GetTransferUseCase,
    GetVolumeReportUseCase,
    { provide: UNIT_OF_WORK, inject: [DataSource], useFactory: (ds: DataSource) => new TypeOrmUnitOfWork(ds) },
    { provide: CRYPTO_PROVIDER, useClass: FakeCryptoProvider },
    { provide: WEBHOOK_SIGNER, useFactory: () => new HmacWebhookSigner(loadWalletConfig().webhookSecret) },
    { provide: WEBHOOK_DELIVERY, useClass: HttpWebhookDelivery },
  ],
})
export class AppModule {}
