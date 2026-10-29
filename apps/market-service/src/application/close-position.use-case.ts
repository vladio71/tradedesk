import { Inject, Injectable } from '@nestjs/common';
import { AssetNotFoundError, PositionNotFoundError } from '../domain/errors';
import { Position } from '../domain/position';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

@Injectable()
export class ClosePositionUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  execute(userId: string, positionId: string): Promise<Position> {
    return this.unitOfWork.run(async (repos) => {
      // The row lock makes a double click on "close" safe: the second request waits and then sees "closed".
      const position = await repos.positions.findByIdForUpdate(positionId, userId);
      if (!position) {
        throw new PositionNotFoundError();
      }
      const asset = await repos.assets.findById(position.assetId);
      if (!asset) {
        throw new AssetNotFoundError(position.symbol);
      }
      position.close(asset.lastPrice, new Date());
      await repos.positions.save(position);
      return position;
    });
  }
}
