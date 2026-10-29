import { Inject, Injectable } from '@nestjs/common';
import { Page } from '@tradedesk/common';
import { Position } from '../domain/position';
import { PnlSummaryRow, PositionFilter } from '../domain/position.repository';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

@Injectable()
export class ListPositionsUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  execute(filter: PositionFilter): Promise<Page<Position>> {
    return this.unitOfWork.run((repos) => repos.positions.list(filter));
  }
}

@Injectable()
export class GetPositionSummaryUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  execute(userId: string): Promise<PnlSummaryRow[]> {
    return this.unitOfWork.run((repos) => repos.positions.summary(userId));
  }
}
