import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@tradedesk/common';
import { DataSource } from 'typeorm';
import { BulkDeleteAssetsUseCase, BulkSetAssetStatusUseCase, BulkUpsertAssetsUseCase } from './application/bulk-assets.use-cases';
import { ClosePositionUseCase } from './application/close-position.use-case';
import { CreateAssetUseCase } from './application/create-asset.use-case';
import { GetCandlesUseCase } from './application/get-candles.use-case';
import { GetPositionSummaryUseCase, ListPositionsUseCase } from './application/list-positions.use-case';
import { OpenPositionUseCase } from './application/open-position.use-case';
import { GetAssetUseCase, SearchAssetsUseCase } from './application/search-assets.use-case';
import { SimulatePricesUseCase } from './application/simulate-prices.use-case';
import { UpdateAssetUseCase } from './application/update-asset.use-case';
import { loadMarketConfig } from './config';
import { ASSET_REPOSITORY } from './domain/asset.repository';
import { RANDOM_SOURCE, TICK_PUBLISHER } from './domain/ports';
import { UNIT_OF_WORK } from './domain/unit-of-work';
import { buildTypeOrmOptions } from './infrastructure/database';
import { PriceSimulator } from './infrastructure/price-simulator';
import { TypeOrmAssetRepository } from './infrastructure/repositories/typeorm-asset.repository';
import { TypeOrmUnitOfWork } from './infrastructure/typeorm-unit-of-work';
import { AssetsController } from './interfaces/http/assets.controller';
import { HealthController } from './interfaces/http/health.controller';
import { PositionsController } from './interfaces/http/positions.controller';
import { MarketGateway } from './interfaces/ws/market.gateway';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forRootAsync({ useFactory: () => buildTypeOrmOptions(loadMarketConfig().databaseUrl) }),
  ],
  controllers: [AssetsController, PositionsController, HealthController],
  providers: [
    SearchAssetsUseCase,
    GetAssetUseCase,
    CreateAssetUseCase,
    UpdateAssetUseCase,
    BulkUpsertAssetsUseCase,
    BulkSetAssetStatusUseCase,
    BulkDeleteAssetsUseCase,
    GetCandlesUseCase,
    OpenPositionUseCase,
    ClosePositionUseCase,
    ListPositionsUseCase,
    GetPositionSummaryUseCase,
    SimulatePricesUseCase,
    MarketGateway,
    { provide: TICK_PUBLISHER, useExisting: MarketGateway },
    { provide: RANDOM_SOURCE, useValue: Math.random },
    { provide: UNIT_OF_WORK, inject: [DataSource], useFactory: (ds: DataSource) => new TypeOrmUnitOfWork(ds) },
    { provide: ASSET_REPOSITORY, inject: [DataSource], useFactory: (ds: DataSource) => new TypeOrmAssetRepository(ds.manager) },
    {
      provide: PriceSimulator,
      inject: [SimulatePricesUseCase],
      useFactory: (simulatePrices: SimulatePricesUseCase) => {
        const config = loadMarketConfig();
        return new PriceSimulator(simulatePrices, config.priceSimulatorEnabled, config.priceSimulatorIntervalMs);
      },
    },
  ],
})
export class AppModule {}
