export const REPORT_REPOSITORY = Symbol('REPORT_REPOSITORY');

export interface VolumeRow {
  day: string;
  transfersCount: number;
  volume: string;
  runningTotal: string;
}

export interface ReportRepository {
  volumePerDay(userId: string, from: Date, to: Date): Promise<VolumeRow[]>;
}
