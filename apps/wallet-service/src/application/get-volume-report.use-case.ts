import { Inject, Injectable } from '@nestjs/common';
import { VolumeRow } from '../domain/report.repository';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

export interface VolumeReportQuery {
  userId: string;
  from?: Date;
  to?: Date;
}

const DEFAULT_RANGE_DAYS = 30;

@Injectable()
export class GetVolumeReportUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork) {}

  execute(query: VolumeReportQuery): Promise<VolumeRow[]> {
    const to = query.to ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
    const from = query.from ?? new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
    return this.unitOfWork.run((repos) => repos.reports.volumePerDay(query.userId, from, to));
  }
}
