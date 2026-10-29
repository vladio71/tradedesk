import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp, createTestDatabase, signAccessToken, TestDatabase } from '@tradedesk/common';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';
import { HmacWebhookSigner } from '../../src/infrastructure/hmac-webhook-signer';

export const ADMIN_URL = process.env.E2E_PG_URL ?? 'postgres://postgres@127.0.0.1:54329/postgres';
export const JWT_SECRET = 'e2e-secret-e2e-secret';
export const WEBHOOK_SECRET = 'e2e-webhook-secret';
export const api = '/api/wallet';

export interface TestUser {
  id: string;
  cookie: string;
  csrf: string;
}

export interface TestApp {
  app: INestApplication;
  close(): Promise<void>;
  sql(text: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  http(): ReturnType<typeof request>;
  newUser(): TestUser;
  /** Funds a user the real way: request a USDT deposit and send the signed webhook. Returns the credited amount. */
  fund(user: TestUser, usdt: string): Promise<void>;
  signedWebhook(body: object): { raw: string; signature: string };
}

export async function bootWallet(): Promise<TestApp> {
  const db: TestDatabase = await createTestDatabase(ADMIN_URL, 'wallet_e2e');
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.COOKIE_SECURE = 'false';
  process.env.WALLET_DATABASE_URL = db.url;
  process.env.CRYPTO_WEBHOOK_SECRET = WEBHOOK_SECRET;

  const { AppModule } = await import('../../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app, { globalPrefix: 'api/wallet', title: 'test' });
  await app.init();
  // Listening on a random port lets /dev/simulate-deposit call the webhook over real HTTP.
  await app.listen(0);

  const signer = new HmacWebhookSigner(WEBHOOK_SECRET);
  const http = () => request(app.getHttpServer());

  const signedWebhook = (body: object) => {
    const raw = JSON.stringify(body);
    return { raw, signature: signer.sign(raw) };
  };

  const newUser = (): TestUser => {
    const id = randomUUID();
    const token = signAccessToken({ id, email: `${id}@example.com`, role: 'user' }, JWT_SECRET, 900);
    return { id, cookie: `access_token=${token}; csrf_token=csrf-abc`, csrf: 'csrf-abc' };
  };

  return {
    app,
    http,
    newUser,
    signedWebhook,
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
    async fund(user, usdt) {
      const created = await http()
        .post(`${api}/deposits`)
        .set('Cookie', user.cookie)
        .set('X-CSRF-Token', user.csrf)
        .set('Idempotency-Key', `fund-${randomUUID()}`)
        .send({ asset: 'USDT', amount: usdt })
        .expect(201);
      const { raw, signature } = signedWebhook({
        eventId: randomUUID(),
        type: 'deposit.confirmed',
        address: created.body.address,
        asset: 'USDT',
        amount: created.body.amount,
        txHash: `tx-${randomUUID()}`,
      });
      await http().post(`${api}/webhooks/crypto`).set('Content-Type', 'application/json').set('X-Signature', signature).send(raw).expect(200);
    },
  };
}

/** Helper for authenticated JSON calls. */
export function authed(ctx: TestApp, user: TestUser, method: 'get' | 'post', path: string, idempotencyKey?: string) {
  const call = ctx.http()[method](`${api}${path}`).set('Cookie', user.cookie);
  if (method === 'post') {
    call.set('X-CSRF-Token', user.csrf);
  }
  if (idempotencyKey) {
    call.set('Idempotency-Key', idempotencyKey);
  }
  return call;
}
