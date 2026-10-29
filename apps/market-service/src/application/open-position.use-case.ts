import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Asset } from '../domain/asset';
import { AssetNotFoundError } from '../domain/errors';
import { Position, PositionSide } from '../domain/position';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

export interface OpenPositionCommand {
  userId: string;
  symbol: string;
  side: PositionSide;
  quantity: string;
}

@Injectable()
export class OpenPositionUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  execute(command: OpenPositionCommand): Promise<Position> {
    return this.unitOfWork.run(async (repos) => {
      const asset = await repos.assets.findBySymbol(Asset.normalizeSymbol(command.symbol));
      if (!asset) {
        throw new AssetNotFoundError(command.symbol);
      }
      const position = Position.open({
        id: randomUUID(),
        userId: command.userId,
        asset,
        side: command.side,
        quantity: command.quantity,
        now: new Date(),
      });
      await repos.positions.insert(position);
      return position;
    });
  }
}
