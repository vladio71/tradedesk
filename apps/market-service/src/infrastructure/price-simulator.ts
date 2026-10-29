import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SimulatePricesUseCase } from '../application/simulate-prices.use-case';

/** Calls the SimulatePrices use case on a timer. Switched on with PRICE_SIMULATOR_ENABLED=true. */
@Injectable()
export class PriceSimulator implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PriceSimulator.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly simulatePrices: SimulatePricesUseCase,
    private readonly enabled: boolean,
    private readonly intervalMs: number,
  ) {}

  onModuleInit(): void {
    if (!this.enabled) {
      return;
    }
    this.logger.log(`Price simulator started, every ${this.intervalMs} ms`);
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async tick(): Promise<void> {
    // Skip a round when the previous one is still running, so rounds never pile up.
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.simulatePrices.execute();
    } catch (error) {
      this.logger.error('Price simulation failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
