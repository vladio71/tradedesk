import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp, createTestDatabase, signAccessToken } from '@tradedesk/common';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';

export const ADMIN_URL = process.env.E2E_PG_URL ?? 'postgres://postgres@127.0.0.1:54329/postgres';
export const JWT_SECRET = 'e2e-secret-e2e-secret';
export const api = '/api/market';

export interface TestUser {
  id: string;
  role: 'user' | 'admin';
  cookie: string;
  csrf: string;
  accessCookie: string;
}

export interface TestApp {
  app: INestApplication;
  port: number;
  close(): Promise<void>;
  sql(text: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  http(): ReturnType<typeof request>;
  newUser(role?: 'user' | 'admin'): TestUser;
}

export async function bootMarket(): Promise<TestApp> {
  const db = await createTestDatabase(ADMIN_URL, 'market_e2e');
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.COOKIE_SECURE = 'false';
  process.env.MARKET_DATABASE_URL = db.url;
  process.env.PRICE_SIMULATOR_ENABLED = 'false';

  const { AppModule } = await import('../../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  configureApp(app, { globalPrefix: 'api/market', title: 'test' });
  await app.init();
  await app.listen(0);
  const port = (app.getHttpServer().address() as { port: number }).port;

  return {
    app,
    port,
    http: () => request(app.getHttpServer()),
    newUser(role = 'user') {
      const id = randomUUID();
      const token = signAccessToken({ id, email: `${id}@example.com`, role }, JWT_SECRET, 900);
      return { id, role, csrf: 'csrf-abc', accessCookie: `access_token=${token}`, cookie: `access_token=${token}; csrf_token=csrf-abc` };
    },
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

export function authed(ctx: TestApp, user: TestUser, method: 'get' | 'post' | 'patch' | 'delete', path: string) {
  const call = ctx.http()[method](`${api}${path}`).set('Cookie', user.cookie);
  if (method !== 'get') {
    call.set('X-CSRF-Token', user.csrf);
  }
  return call;
}
