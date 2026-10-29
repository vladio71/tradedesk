import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitWalletSchema1700000000000 implements MigrationInterface {
  name = 'InitWalletSchema1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE wallets (
        id         uuid PRIMARY KEY,
        user_id    uuid NOT NULL UNIQUE,
        balance    numeric(20,8) NOT NULL DEFAULT 0 CONSTRAINT ck_wallets_balance_non_negative CHECK (balance >= 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);

    await queryRunner.query(`
      CREATE TABLE deposits (
        id              uuid PRIMARY KEY,
        user_id         uuid NOT NULL,
        wallet_id       uuid NOT NULL REFERENCES wallets(id),
        asset           varchar(10) NOT NULL CHECK (asset IN ('BTC', 'ETH', 'USDT')),
        amount          numeric(20,8) NOT NULL CHECK (amount > 0),
        usd_rate        numeric(20,8) NOT NULL CHECK (usd_rate > 0),
        credit_amount   numeric(20,8) NOT NULL CHECK (credit_amount > 0),
        address         varchar(100) NOT NULL UNIQUE,
        tx_hash         varchar(100),
        status          varchar(10) NOT NULL CHECK (status IN ('pending', 'confirmed')),
        idempotency_key varchar(128) NOT NULL,
        created_at      timestamptz NOT NULL DEFAULT now(),
        confirmed_at    timestamptz,
        CONSTRAINT uq_deposits_user_idempotency_key UNIQUE (user_id, idempotency_key)
      )`);
    await queryRunner.query(`CREATE INDEX idx_deposits_user_created ON deposits (user_id, created_at DESC)`);

    await queryRunner.query(`
      CREATE TABLE transfers (
        id              uuid PRIMARY KEY,
        from_user_id    uuid NOT NULL,
        to_user_id      uuid NOT NULL,
        from_wallet_id  uuid NOT NULL REFERENCES wallets(id),
        to_wallet_id    uuid NOT NULL REFERENCES wallets(id),
        amount          numeric(20,8) NOT NULL CHECK (amount > 0),
        status          varchar(10) NOT NULL DEFAULT 'completed',
        note            varchar(200),
        idempotency_key varchar(128) NOT NULL,
        created_at      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_transfers_distinct_users CHECK (from_user_id <> to_user_id),
        CONSTRAINT uq_transfers_sender_idempotency_key UNIQUE (from_user_id, idempotency_key)
      )`);
    await queryRunner.query(`CREATE INDEX idx_transfers_from_created ON transfers (from_user_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_transfers_to_created ON transfers (to_user_id, created_at DESC)`);

    // The unique index is a safety net: one deposit or transfer can write only one entry per wallet and kind.
    await queryRunner.query(`
      CREATE TABLE ledger_entries (
        id            uuid PRIMARY KEY,
        wallet_id     uuid NOT NULL REFERENCES wallets(id),
        kind          varchar(20) NOT NULL CHECK (kind IN ('deposit', 'transfer_in', 'transfer_out')),
        direction     varchar(6)  NOT NULL CHECK (direction IN ('credit', 'debit')),
        amount        numeric(20,8) NOT NULL CHECK (amount > 0),
        balance_after numeric(20,8) NOT NULL CHECK (balance_after >= 0),
        reference_id  uuid NOT NULL,
        created_at    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_ledger_wallet_kind_reference UNIQUE (wallet_id, kind, reference_id)
      )`);
    await queryRunner.query(`CREATE INDEX idx_ledger_wallet_created ON ledger_entries (wallet_id, created_at DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE ledger_entries`);
    await queryRunner.query(`DROP TABLE transfers`);
    await queryRunner.query(`DROP TABLE deposits`);
    await queryRunner.query(`DROP TABLE wallets`);
  }
}
