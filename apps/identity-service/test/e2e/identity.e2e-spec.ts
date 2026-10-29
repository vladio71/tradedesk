import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { attributeValue, bootIdentity, CookieInfo, hasAttribute, readCookies, TestApp } from './support';

describe('Identity service (e2e, real Postgres)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  const api = '/api/identity';

  beforeAll(async () => {
    ctx = await bootIdentity();
    app = ctx.app;
  });

  afterAll(async () => {
    await ctx.close();
  });

  const http = () => request(app.getHttpServer());

  async function register(email: string, password = 'password123', displayName = 'Test User') {
    return http().post(`${api}/auth/register`).send({ email, password, displayName });
  }

  interface Session {
    access: string;
    refresh: string;
    csrf: string;
  }

  async function login(email: string, password = 'password123'): Promise<Session> {
    const response = await http().post(`${api}/auth/login`).send({ email, password }).expect(200);
    const cookies = readCookies(response);
    return { access: cookies.access_token.value, refresh: cookies.refresh_token.value, csrf: cookies.csrf_token.value };
  }

  const cookieHeader = (session: Session, parts: Array<'access' | 'refresh'> = ['access']) =>
    [
      ...(parts.includes('access') ? [`access_token=${session.access}`] : []),
      ...(parts.includes('refresh') ? [`refresh_token=${session.refresh}`] : []),
      `csrf_token=${session.csrf}`,
    ].join('; ');

  describe('register and login', () => {
    it('registers without returning the password and refuses a duplicate email', async () => {
      const first = await register('anna@example.com');
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({ email: 'anna@example.com', role: 'user', displayName: 'Test User' });
      expect(JSON.stringify(first.body)).not.toContain('password');

      const duplicate = await register('ANNA@example.com');
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.code).toBe('EMAIL_ALREADY_USED');
    });

    it('validates input', async () => {
      const response = await register('not-an-email', 'short');
      expect(response.status).toBe(400);
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    it('rejects a wrong password and an unknown email with the same answer', async () => {
      await register('bob@example.com');
      const wrong = await http().post(`${api}/auth/login`).send({ email: 'bob@example.com', password: 'wrong-password' });
      const unknown = await http().post(`${api}/auth/login`).send({ email: 'ghost@example.com', password: 'password123' });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body.code).toBe(unknown.body.code);
    });

    it('sets the three cookies with the right flags', async () => {
      await register('cookies@example.com');
      const response = await http().post(`${api}/auth/login`).send({ email: 'cookies@example.com', password: 'password123' }).expect(200);
      const cookies = readCookies(response);

      const access: CookieInfo = cookies.access_token;
      expect(hasAttribute(access, 'HttpOnly')).toBe(true);
      expect(attributeValue(access, 'SameSite')).toBe('Lax');
      expect(attributeValue(access, 'Max-Age')).toBe('900');
      expect(attributeValue(access, 'Path')).toBe('/');
      expect(hasAttribute(access, 'Secure')).toBe(false); // COOKIE_SECURE=false, so it works on http://localhost

      const refresh = cookies.refresh_token;
      expect(hasAttribute(refresh, 'HttpOnly')).toBe(true);
      expect(attributeValue(refresh, 'Path')).toBe('/api/identity/auth');
      expect(attributeValue(refresh, 'Max-Age')).toBe(String(7 * 24 * 60 * 60));

      const csrf = cookies.csrf_token;
      expect(hasAttribute(csrf, 'HttpOnly')).toBe(false);
      expect(csrf.value.length).toBeGreaterThan(20);
    });

    it('stores only a hash of the refresh token', async () => {
      await register('hash@example.com');
      const session = await login('hash@example.com');
      const rows = await ctx.sql(`SELECT token_hash FROM refresh_tokens`);
      expect(rows.some((row) => row.token_hash === session.refresh)).toBe(false);
      expect(rows.every((row) => String(row.token_hash).length === 64)).toBe(true);
    });
  });

  describe('access token cookie', () => {
    it('GET /auth/me needs the cookie', async () => {
      await register('me@example.com');
      const session = await login('me@example.com');

      await http().get(`${api}/auth/me`).expect(401);
      const response = await http().get(`${api}/auth/me`).set('Cookie', cookieHeader(session)).expect(200);
      expect(response.body.email).toBe('me@example.com');
    });

    it('refuses a token signed with another secret', async () => {
      const forged = (await import('jsonwebtoken')).sign({ sub: 'x', email: 'x@x.com', role: 'admin' }, 'another-secret-another-secret');
      await http().get(`${api}/auth/me`).set('Cookie', `access_token=${forged}`).expect(401);
    });
  });

  describe('CSRF double submit', () => {
    it('blocks unsafe methods without the header, and with a wrong header', async () => {
      await register('csrf@example.com');
      const session = await login('csrf@example.com');

      const missing = await http().patch(`${api}/users/me`).set('Cookie', cookieHeader(session)).send({ displayName: 'New' });
      expect(missing.status).toBe(403);

      const wrong = await http().patch(`${api}/users/me`).set('Cookie', cookieHeader(session)).set('X-CSRF-Token', 'wrong').send({ displayName: 'New' });
      expect(wrong.status).toBe(403);

      const ok = await http().patch(`${api}/users/me`).set('Cookie', cookieHeader(session)).set('X-CSRF-Token', session.csrf).send({ displayName: 'New' });
      expect(ok.status).toBe(200);
      expect(ok.body.displayName).toBe('New');
    });

    it('does not apply to safe methods', async () => {
      await register('csrf-get@example.com');
      const session = await login('csrf-get@example.com');
      await http().get(`${api}/auth/me`).set('Cookie', `access_token=${session.access}`).expect(200);
    });
  });

  describe('refresh token rotation', () => {
    it('rotates the token and keeps the family', async () => {
      await register('rotate@example.com');
      const first = await login('rotate@example.com');

      const response = await http()
        .post(`${api}/auth/refresh`)
        .set('Cookie', cookieHeader(first, ['refresh']))
        .set('X-CSRF-Token', first.csrf)
        .expect(200);
      const cookies = readCookies(response);
      expect(cookies.refresh_token.value).not.toBe(first.refresh);
      expect(cookies.access_token.value).toBeTruthy();

      const rows = await ctx.sql(`SELECT family_id, revoked_at, replaced_by_id FROM refresh_tokens ORDER BY created_at DESC LIMIT 2`);
      expect(rows[0].family_id).toBe(rows[1].family_id);
      expect(rows.filter((row) => row.revoked_at !== null)).toHaveLength(1);
    });

    it('needs the CSRF header too', async () => {
      await register('rotate-csrf@example.com');
      const session = await login('rotate-csrf@example.com');
      await http().post(`${api}/auth/refresh`).set('Cookie', cookieHeader(session, ['refresh'])).expect(403);
    });

    it('detects reuse of an old token and revokes the whole family', async () => {
      await register('reuse@example.com');
      const first = await login('reuse@example.com');

      const rotated = await http().post(`${api}/auth/refresh`).set('Cookie', cookieHeader(first, ['refresh'])).set('X-CSRF-Token', first.csrf).expect(200);
      const second: Session = { ...first, refresh: readCookies(rotated).refresh_token.value };

      // An attacker (or a stale tab) replays the old token.
      const replay = await http().post(`${api}/auth/refresh`).set('Cookie', cookieHeader(first, ['refresh'])).set('X-CSRF-Token', first.csrf);
      expect(replay.status).toBe(401);
      expect(replay.body.code).toBe('REFRESH_TOKEN_REUSE');

      // The revocation was committed: the newest token of the family is dead as well.
      const afterwards = await http().post(`${api}/auth/refresh`).set('Cookie', cookieHeader(second, ['refresh'])).set('X-CSRF-Token', second.csrf);
      expect(afterwards.status).toBe(401);

      const alive = await ctx.sql(
        `SELECT count(*)::int AS n FROM refresh_tokens t JOIN users u ON u.id = t.user_id WHERE u.email = 'reuse@example.com' AND t.revoked_at IS NULL`,
      );
      expect(alive[0].n).toBe(0);
    });

    it('lets only one of two parallel refreshes with the same token win', async () => {
      await register('parallel@example.com');
      const session = await login('parallel@example.com');

      const attempts = await Promise.all(
        [1, 2, 3].map(() =>
          http().post(`${api}/auth/refresh`).set('Cookie', cookieHeader(session, ['refresh'])).set('X-CSRF-Token', session.csrf),
        ),
      );
      const statuses = attempts.map((response) => response.status).sort();
      expect(statuses).toEqual([200, 401, 401]);
    });

    it('rejects a missing or random token', async () => {
      await register('nothing@example.com');
      const session = await login('nothing@example.com');
      await http().post(`${api}/auth/refresh`).set('Cookie', `csrf_token=${session.csrf}`).set('X-CSRF-Token', session.csrf).expect(401);
      await http()
        .post(`${api}/auth/refresh`)
        .set('Cookie', `refresh_token=garbage; csrf_token=${session.csrf}`)
        .set('X-CSRF-Token', session.csrf)
        .expect(401);
    });
  });

  describe('logout', () => {
    it('clears cookies and kills the refresh token', async () => {
      await register('logout@example.com');
      const session = await login('logout@example.com');

      const response = await http().post(`${api}/auth/logout`).set('Cookie', cookieHeader(session, ['access', 'refresh'])).set('X-CSRF-Token', session.csrf);
      expect(response.status).toBe(204);
      const cleared = readCookies(response);
      expect(cleared.access_token.value).toBe('');
      expect(cleared.refresh_token.value).toBe('');

      await http().post(`${api}/auth/refresh`).set('Cookie', cookieHeader(session, ['refresh'])).set('X-CSRF-Token', session.csrf).expect(401);
    });
  });

  describe('users', () => {
    it('changes the password, signs out other sessions, and the new password works', async () => {
      await register('pw@example.com');
      const session = await login('pw@example.com');

      const wrong = await http()
        .post(`${api}/users/me/password`)
        .set('Cookie', cookieHeader(session))
        .set('X-CSRF-Token', session.csrf)
        .send({ currentPassword: 'not-my-password', newPassword: 'new-password-1' });
      expect(wrong.status).toBe(401);

      await http()
        .post(`${api}/users/me/password`)
        .set('Cookie', cookieHeader(session))
        .set('X-CSRF-Token', session.csrf)
        .send({ currentPassword: 'password123', newPassword: 'new-password-1' })
        .expect(204);

      await http().post(`${api}/auth/refresh`).set('Cookie', cookieHeader(session, ['refresh'])).set('X-CSRF-Token', session.csrf).expect(401);
      await http().post(`${api}/auth/login`).send({ email: 'pw@example.com', password: 'password123' }).expect(401);
      await login('pw@example.com', 'new-password-1');
    });

    it('lists users for admins only, with paging and filters', async () => {
      await register('admin@example.com', 'password123', 'Boss');
      await ctx.sql(`UPDATE users SET role = 'admin' WHERE email = 'admin@example.com'`);
      const admin = await login('admin@example.com');
      const normal = await login('anna@example.com');

      await http().get(`${api}/users`).set('Cookie', cookieHeader(normal)).expect(403);
      await http().get(`${api}/users`).expect(401);

      const all = await http().get(`${api}/users?pageSize=2&page=1`).set('Cookie', cookieHeader(admin)).expect(200);
      expect(all.body.items).toHaveLength(2);
      expect(all.body.total).toBeGreaterThan(2);
      expect(all.body.totalPages).toBeGreaterThan(1);

      const admins = await http().get(`${api}/users?role=admin`).set('Cookie', cookieHeader(admin)).expect(200);
      expect(admins.body.items.map((user: { email: string }) => user.email)).toEqual(['admin@example.com']);

      const search = await http().get(`${api}/users?q=boss`).set('Cookie', cookieHeader(admin)).expect(200);
      expect(search.body.total).toBe(1);

      await http().get(`${api}/users?pageSize=1000`).set('Cookie', cookieHeader(admin)).expect(400);
    });
  });

  it('returns the same error shape everywhere and a request id', async () => {
    const response = await http().get(`${api}/auth/me`).set('X-Request-Id', 'req-123');
    expect(response.headers['x-request-id']).toBe('req-123');
    expect(response.body).toMatchObject({ statusCode: 401, requestId: 'req-123', path: `${api}/auth/me` });
  });

  it('serves swagger and health', async () => {
    await http().get('/docs').expect((res) => expect([200, 301, 302]).toContain(res.status));
    await http().get('/docs-json').expect(200);
    const health = await http().get(`${api}/health`).expect(200);
    expect(health.body).toEqual({ status: 'ok' });
  });
});
