import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitMarketSchema1700000000000 implements MigrationInterface {
  name = 'InitMarketSchema1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE assets (
        id         uuid PRIMARY KEY,
        symbol     varchar(20) NOT NULL UNIQUE,
        name       varchar(100) NOT NULL,
        category   varchar(20) NOT NULL CHECK (category IN ('crypto', 'stock', 'forex', 'commodity')),
        status     varchar(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'halted', 'delisted')),
        last_price numeric(20,8) NOT NULL CHECK (last_price > 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )`);
    await queryRunner.query(`CREATE INDEX idx_assets_category_status ON assets (category, status) WHERE deleted_at IS NULL`);

    await queryRunner.query(`
      CREATE TABLE price_ticks (
        id       bigserial PRIMARY KEY,
        asset_id uuid NOT NULL REFERENCES assets(id),
        price    numeric(20,8) NOT NULL CHECK (price > 0),
        ts       timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX idx_price_ticks_asset_ts ON price_ticks (asset_id, ts)`);

    await queryRunner.query(`
      CREATE TABLE positions (
        id           uuid PRIMARY KEY,
        user_id      uuid NOT NULL,
        asset_id     uuid NOT NULL REFERENCES assets(id),
        symbol       varchar(20) NOT NULL,
        side         varchar(5) NOT NULL CHECK (side IN ('long', 'short')),
        quantity     numeric(20,8) NOT NULL CHECK (quantity > 0),
        entry_price  numeric(20,8) NOT NULL CHECK (entry_price > 0),
        status       varchar(6) NOT NULL CHECK (status IN ('open', 'closed')),
        closed_price numeric(20,8),
        pnl          numeric(20,8),
        opened_at    timestamptz NOT NULL DEFAULT now(),
        closed_at    timestamptz,
        CONSTRAINT ck_positions_closed_fields CHECK (
          (status = 'open' AND closed_price IS NULL AND pnl IS NULL AND closed_at IS NULL)
          OR (status = 'closed' AND closed_price IS NOT NULL AND pnl IS NOT NULL AND closed_at IS NOT NULL)
        )
      )`);
    await queryRunner.query(`CREATE INDEX idx_positions_user_opened ON positions (user_id, opened_at DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE positions`);
    await queryRunner.query(`DROP TABLE price_ticks`);
    await queryRunner.query(`DROP TABLE assets`);
  }
}
