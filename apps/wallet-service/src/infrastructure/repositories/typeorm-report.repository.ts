import { EntityManager } from 'typeorm';
import { ReportRepository, VolumeRow } from '../../domain/report.repository';

interface VolumeSqlRow {
  day: Date;
  transfers_count: string;
  volume: string;
  running_total: string;
}

export class TypeOrmReportRepository implements ReportRepository {
  constructor(private readonly manager: EntityManager) {}

  async volumePerDay(userId: string, from: Date, to: Date): Promise<VolumeRow[]> {
    // The inner query groups transfers per day. The outer query adds the running total with a window function.
    const rows: VolumeSqlRow[] = await this.manager.query(
      `SELECT d.day,
              d.transfers_count,
              d.volume,
              SUM(d.volume) OVER (ORDER BY d.day) AS running_total
         FROM (
                SELECT date_trunc('day', t.created_at) AS day,
                       COUNT(*)                        AS transfers_count,
                       SUM(t.amount)                   AS volume
                  FROM transfers t
                 WHERE (t.from_user_id = $1 OR t.to_user_id = $1)
                   AND t.created_at >= $2
                   AND t.created_at <  $3
                 GROUP BY 1
              ) d
        ORDER BY d.day`,
      [userId, from, to],
    );
    return rows.map((row) => ({
      day: row.day.toISOString(),
      transfersCount: Number(row.transfers_count),
      volume: row.volume,
      runningTotal: row.running_total,
    }));
  }
}
