import { Inject, Injectable } from '@nestjs/common';
import { Page, PageRequest } from '@tradedesk/common';
import { TransferNotFoundError } from '../domain/errors';
import { Transfer } from '../domain/transfer';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

@Injectable()
export class ListTransfersUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  execute(userId: string, request: PageRequest): Promise<Page<Transfer>> {
    return this.unitOfWork.run((repos) => repos.transfers.listForUser(userId, request));
  }
}

@Injectable()
export class GetTransferUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  async execute(userId: string, transferId: string): Promise<Transfer> {
    const transfer = await this.unitOfWork.run((repos) => repos.transfers.findByIdForUser(transferId, userId));
    if (!transfer) {
      throw new TransferNotFoundError();
    }
    return transfer;
  }
}
