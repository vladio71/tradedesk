import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitIdentitySchema1700000000000 implements MigrationInterface {
  name = 'InitIdentitySchema1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id            uuid PRIMARY KEY,
        email         varchar(254) NOT NULL UNIQUE,
        password_hash varchar(100) NOT NULL,
        display_name  varchar(60)  NOT NULL,
        role          varchar(10)  NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at    timestamptz  NOT NULL DEFAULT now(),
        updated_at    timestamptz  NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id             uuid PRIMARY KEY,
        user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        family_id      uuid NOT NULL,
        token_hash     varchar(64) NOT NULL UNIQUE,
        expires_at     timestamptz NOT NULL,
        revoked_at     timestamptz,
        replaced_by_id uuid REFERENCES refresh_tokens(id),
        created_at     timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id)`);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE refresh_tokens`);
    await queryRunner.query(`DROP TABLE users`);
  }
}
