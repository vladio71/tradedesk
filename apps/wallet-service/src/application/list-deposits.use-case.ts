import { Inject, Injectable } from '@nestjs/common';
import { Page, PageRequest } from '@tradedesk/common';
import { Deposit } from '../domain/deposit';
import { DepositNotFoundError } from '../domain/errors';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

@Injectable()
export class ListDepositsUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  execute(userId: string, request: PageRequest): Promise<Page<Deposit>> {
    return this.unitOfWork.run((repos) => repos.deposits.listForUser(userId, request));
  }
}

@Injectable()
export class GetDepositUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  async execute(userId: string, depositId: string): Promise<Deposit> {
    const deposit = await this.unitOfWork.run((repos) => repos.deposits.findByIdForUser(depositId, userId));
    if (!deposit) {
      throw new DepositNotFoundError();
    }
    return deposit;
  }
}
