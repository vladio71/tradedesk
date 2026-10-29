import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp, createTestDatabase, TestDatabase } from '@tradedesk/common';
import { Client } from 'pg';
import request from 'supertest';

export const ADMIN_URL = process.env.E2E_PG_URL ?? 'postgres://postgres@127.0.0.1:54329/postgres';

export interface TestApp {
  app: INestApplication;
  db: TestDatabase;
  close(): Promise<void>;
  sql(text: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

export async function bootIdentity(): Promise<TestApp> {
  const db = await createTestDatabase(ADMIN_URL, 'identity_e2e');
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'e2e-secret-e2e-secret';
  process.env.COOKIE_SECURE = 'false';
  process.env.IDENTITY_DATABASE_URL = db.url;

  // Imported after the environment is ready, because modules read it while they are built.
  const { AppModule } = await import('../../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app, { globalPrefix: 'api/identity', title: 'test' });
  await app.init();

  return {
    app,
    db,
    async close() {
      await app.close();
      await db.drop();
    },
    async sql(text, params) {
      const client = new Client({ connectionString: db.url });
      await client.connect();
      try {
        return (await client.query(text, params)).rows;
      } finally {
        await client.end();
      }
    },
  };
}

export interface CookieInfo {
  value: string;
  attributes: string[];
}

/** Reads the Set-Cookie headers of a response into { name: { value, attributes } }. */
export function readCookies(response: request.Response): Record<string, CookieInfo> {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined;
  const result: Record<string, CookieInfo> = {};
  for (const line of header ?? []) {
    const [pair, ...attributes] = line.split(';').map((part) => part.trim());
    const index = pair.indexOf('=');
    result[pair.slice(0, index)] = { value: pair.slice(index + 1), attributes };
  }
  return result;
}

export function hasAttribute(cookie: CookieInfo, name: string): boolean {
  return cookie.attributes.some((attribute) => attribute.toLowerCase() === name.toLowerCase());
}

export function attributeValue(cookie: CookieInfo, name: string): string | undefined {
  const found = cookie.attributes.find((attribute) => attribute.toLowerCase().startsWith(`${name.toLowerCase()}=`));
  return found?.split('=')[1];
}
