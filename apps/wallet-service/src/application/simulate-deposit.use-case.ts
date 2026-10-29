import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DepositNotFoundError } from '../domain/errors';
import { CryptoWebhookEvent, WEBHOOK_DELIVERY, WEBHOOK_SIGNER, WebhookDelivery, WebhookSigner } from '../domain/ports';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

export interface SimulateDepositCommand {
  userId: string;
  depositId: string;
  /** Full URL of this service's own webhook endpoint. */
  webhookUrl: string;
}

/** Dev helper: plays the role of the crypto provider and sends a signed webhook for a pending deposit. */
@Injectable()
export class SimulateDepositUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(WEBHOOK_SIGNER) private readonly signer: WebhookSigner,
    @Inject(WEBHOOK_DELIVERY) private readonly delivery: WebhookDelivery,
  ) {}

  async execute(command: SimulateDepositCommand): Promise<{ status: number; body: unknown }> {
    const deposit = await this.unitOfWork.run((repos) => repos.deposits.findByIdForUser(command.depositId, command.userId));
    if (!deposit) {
      throw new DepositNotFoundError();
    }
    const event: CryptoWebhookEvent = {
      eventId: randomUUID(),
      type: 'deposit.confirmed',
      address: deposit.address,
      asset: deposit.asset,
      amount: deposit.amount.toString(),
      txHash: `0x${randomUUID().replace(/-/g, '')}`,
    };
    const rawBody = JSON.stringify(event);
    return this.delivery.deliver(command.webhookUrl, rawBody, this.signer.sign(rawBody));
  }
}
