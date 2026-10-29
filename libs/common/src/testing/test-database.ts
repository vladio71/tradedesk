import { randomBytes } from 'node:crypto';
import { Client } from 'pg';

export interface TestDatabase {
  url: string;
  drop(): Promise<void>;
}

/**
 * Creates a throwaway database on a real Postgres for e2e tests.
 * `adminUrl` points at any existing database, for example postgres://postgres@127.0.0.1:54329/postgres
 */
export async function createTestDatabase(adminUrl: string, prefix: string): Promise<TestDatabase> {
  const name = `${prefix}_${randomBytes(4).toString('hex')}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;

  return {
    url: url.toString(),
    async drop(): Promise<void> {
      const client = new Client({ connectionString: adminUrl });
      await client.connect();
      await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await client.end();
    },
  };
}
