import { randomUUID } from 'node:crypto';
import { io, Socket } from 'socket.io-client';
import { SimulatePricesUseCase } from '../../src/application/simulate-prices.use-case';
import { MarketGateway } from '../../src/interfaces/ws/market.gateway';
import { api, authed, bootMarket, TestApp } from './support';

describe('Market service (e2e, real Postgres)', () => {
  let ctx: TestApp;
  const admin = () => ctx.newUser('admin');

  beforeAll(async () => {
    ctx = await bootMarket();
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function createAsset(symbol: string, price: string, extra: Record<string, unknown> = {}) {
    const response = await authed(ctx, admin(), 'post', '/assets').send({ symbol, name: `${symbol} Inc`, category: 'stock', lastPrice: price, ...extra });
    expect(response.status).toBe(201);
    return response.body as { id: string; symbol: string };
  }

  const setPrice = (symbol: string, price: string) => ctx.sql(`UPDATE assets SET last_price = $2 WHERE symbol = $1`, [symbol, price]);

  describe('assets: access and CRUD', () => {
    it('needs a signed in user, and admin for writes', async () => {
      await ctx.http().get(`${api}/assets`).expect(401);
      const user = ctx.newUser();
      await authed(ctx, user, 'get', '/assets').expect(200);
      await authed(ctx, user, 'post', '/assets').send({ symbol: 'NOPE', name: 'x', category: 'stock', lastPrice: '1' }).expect(403);
      await authed(ctx, user, 'post', '/assets/bulk').send({ assets: [] }).expect(403);
      await authed(ctx, user, 'post', '/assets/bulk/status').send({ ids: [randomUUID()], status: 'halted' }).expect(403);
      await authed(ctx, user, 'delete', '/assets/bulk').send({ ids: [randomUUID()] }).expect(403);
      await authed(ctx, user, 'patch', `/assets/${randomUUID()}`).send({ name: 'x' }).expect(403);
    });

    it('admin creates, reads and updates an asset', async () => {
      const created = await authed(ctx, admin(), 'post', '/assets').send({ symbol: 'crud1', name: 'Crud One', category: 'crypto', lastPrice: '12.5' });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ symbol: 'CRUD1', status: 'active', lastPrice: '12.50000000', category: 'crypto' });

      const duplicate = await authed(ctx, admin(), 'post', '/assets').send({ symbol: 'CRUD1', name: 'again', category: 'crypto', lastPrice: '1' });
      expect(duplicate.status).toBe(409);

      const read = await authed(ctx, ctx.newUser(), 'get', '/assets/crud1').expect(200);
      expect(read.body.name).toBe('Crud One');
      await authed(ctx, ctx.newUser(), 'get', '/assets/NOSUCH').expect(404);

      const patched = await authed(ctx, admin(), 'patch', `/assets/${created.body.id}`).send({ name: 'Renamed', status: 'halted' }).expect(200);
      expect(patched.body).toMatchObject({ name: 'Renamed', status: 'halted' });
      await authed(ctx, admin(), 'patch', `/assets/${created.body.id}`).send({ symbol: 'CHANGED' }).expect(400);
    });

    it('validates the body', async () => {
      await authed(ctx, admin(), 'post', '/assets').send({ symbol: 'bad symbol!', name: 'x', category: 'stock', lastPrice: '1' }).expect(400);
      await authed(ctx, admin(), 'post', '/assets').send({ symbol: 'ZERO', name: 'x', category: 'stock', lastPrice: '0' }).expect(422);
      await authed(ctx, admin(), 'post', '/assets').send({ symbol: 'FLT', name: 'x', category: 'stock', lastPrice: 1.5 }).expect(400);
    });
  });

  describe('assets: search', () => {
    beforeAll(async () => {
      await authed(ctx, admin(), 'post', '/assets/bulk').send({
        assets: [
          { symbol: 'SRCH-A', name: 'Alpha Coin', category: 'crypto', lastPrice: '10' },
          { symbol: 'SRCH-B', name: 'Beta Coin', category: 'crypto', lastPrice: '200', status: 'halted' },
          { symbol: 'SRCH-C', name: 'Gamma Shares', category: 'stock', lastPrice: '3000' },
          { symbol: 'SRCH-D', name: 'Delta Oil', category: 'commodity', lastPrice: '75.5' },
        ],
      }).expect(200);
    });

    const search = async (query: string) => {
      const response = await authed(ctx, ctx.newUser(), 'get', `/assets?${query}`).expect(200);
      return response.body as { items: { symbol: string }[]; total: number; totalPages: number };
    };

    it('filters by q, category, status and price range', async () => {
      expect((await search('q=SRCH-')).total).toBe(4);
      expect((await search('q=coin')).items.map((i) => i.symbol)).toEqual(['SRCH-A', 'SRCH-B']);
      expect((await search('q=SRCH-&category=crypto')).total).toBe(2);
      expect((await search('q=SRCH-&status=halted')).items.map((i) => i.symbol)).toEqual(['SRCH-B']);
      expect((await search('q=SRCH-&minPrice=100&maxPrice=1000')).items.map((i) => i.symbol)).toEqual(['SRCH-B']);
      expect((await search('q=SRCH-&minPrice=75.5')).total).toBe(3);
    });

    it('sorts and paginates', async () => {
      expect((await search('q=SRCH-&sort=lastPrice&order=desc')).items.map((i) => i.symbol)).toEqual(['SRCH-C', 'SRCH-B', 'SRCH-D', 'SRCH-A']);
      const page2 = await search('q=SRCH-&sort=symbol&pageSize=3&page=2');
      expect(page2.items.map((i) => i.symbol)).toEqual(['SRCH-D']);
      expect(page2.totalPages).toBe(2);
    });

    it('rejects unknown sort fields and bad filters (no SQL injection through sort)', async () => {
      await authed(ctx, ctx.newUser(), 'get', '/assets?sort=id;DROP TABLE assets').expect(400);
      await authed(ctx, ctx.newUser(), 'get', '/assets?minPrice=abc').expect(400);
      await authed(ctx, ctx.newUser(), 'get', '/assets?category=nope').expect(400);
      await authed(ctx, ctx.newUser(), 'get', '/assets?q=%25%27%3B--').expect(200);
    });
  });

  describe('bulk operations', () => {
    it('upsert returns created and updated counts', async () => {
      await createAsset('BULK-EXIST', '5');
      const response = await authed(ctx, admin(), 'post', '/assets/bulk').send({
        assets: [
          { symbol: 'bulk-exist', name: 'Renamed By Bulk', category: 'forex', lastPrice: '6' },
          { symbol: 'BULK-NEW1', name: 'New 1', category: 'stock', lastPrice: '1.5' },
          { symbol: 'BULK-NEW2', name: 'New 2', category: 'stock', lastPrice: '2.5' },
        ],
      });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ created: 2, updated: 1 });

      const updated = await authed(ctx, ctx.newUser(), 'get', '/assets/BULK-EXIST').expect(200);
      expect(updated.body).toMatchObject({ name: 'Renamed By Bulk', category: 'forex', lastPrice: '6.00000000' });
    });

    it('upsert handles 500 rows in one call', async () => {
      const assets = Array.from({ length: 500 }, (_, i) => ({ symbol: `MASS-${i}`, name: `Mass ${i}`, category: 'stock', lastPrice: `${i + 1}.25` }));
      const first = await authed(ctx, admin(), 'post', '/assets/bulk').send({ assets }).expect(200);
      expect(first.body).toEqual({ created: 500, updated: 0 });
      const second = await authed(ctx, admin(), 'post', '/assets/bulk').send({ assets }).expect(200);
      expect(second.body).toEqual({ created: 0, updated: 500 });
    });

    it('upsert is all or nothing: a bad row rejects the whole batch', async () => {
      const bad = await authed(ctx, admin(), 'post', '/assets/bulk').send({
        assets: [
          { symbol: 'ATOMIC-1', name: 'ok', category: 'stock', lastPrice: '1' },
          { symbol: 'ATOMIC-2', name: 'bad', category: 'stock', lastPrice: '-1' },
        ],
      });
      expect(bad.status).toBe(400);
      await authed(ctx, ctx.newUser(), 'get', '/assets/ATOMIC-1').expect(404);

      const duplicates = await authed(ctx, admin(), 'post', '/assets/bulk').send({
        assets: [
          { symbol: 'DUP-1', name: 'a', category: 'stock', lastPrice: '1' },
          { symbol: 'dup-1', name: 'b', category: 'stock', lastPrice: '2' },
        ],
      });
      expect(duplicates.status).toBe(422);
      expect(duplicates.body.code).toBe('DUPLICATE_SYMBOLS_IN_BATCH');
      await authed(ctx, admin(), 'post', '/assets/bulk').send({ assets: [] }).expect(400);
    });

    it('status change is atomic: one unknown id means nothing changes', async () => {
      const a = await createAsset('ST-A', '1');
      const b = await createAsset('ST-B', '1');

      const failed = await authed(ctx, admin(), 'post', '/assets/bulk/status').send({ ids: [a.id, b.id, randomUUID()], status: 'halted' });
      expect(failed.status).toBe(404);
      expect(failed.body.code).toBe('ASSETS_MISSING');
      const unchanged = await ctx.sql(`SELECT status FROM assets WHERE symbol IN ('ST-A', 'ST-B')`);
      expect(unchanged.every((row) => row.status === 'active')).toBe(true);

      const ok = await authed(ctx, admin(), 'post', '/assets/bulk/status').send({ ids: [a.id, b.id, a.id], status: 'halted' });
      expect(ok.status).toBe(200);
      expect(ok.body).toEqual({ affected: 2 });
      const changed = await ctx.sql(`SELECT status FROM assets WHERE symbol IN ('ST-A', 'ST-B')`);
      expect(changed.every((row) => row.status === 'halted')).toBe(true);
    });

    it('soft delete hides assets and an upsert brings them back', async () => {
      const a = await createAsset('DEL-A', '1');
      const b = await createAsset('DEL-B', '1');

      const response = await authed(ctx, admin(), 'delete', '/assets/bulk').send({ ids: [a.id, b.id, randomUUID()] }).expect(200);
      expect(response.body).toEqual({ affected: 2 });
      await authed(ctx, ctx.newUser(), 'get', '/assets/DEL-A').expect(404);
      expect(await ctx.sql(`SELECT 1 FROM assets WHERE symbol = 'DEL-A'`)).toHaveLength(1); // still in the table

      const again = await authed(ctx, admin(), 'post', '/assets/bulk').send({ assets: [{ symbol: 'DEL-A', name: 'Back', category: 'stock', lastPrice: '2' }] }).expect(200);
      expect(again.body).toEqual({ created: 0, updated: 1 });
      await authed(ctx, ctx.newUser(), 'get', '/assets/DEL-A').expect(200);
    });
  });

  describe('positions', () => {
    it('opens at the current price and closes with pnl', async () => {
      await createAsset('POS-LONG', '100');
      const user = ctx.newUser();

      const opened = await authed(ctx, user, 'post', '/positions').send({ symbol: 'pos-long', side: 'long', quantity: '2' });
      expect(opened.status).toBe(201);
      expect(opened.body).toMatchObject({ symbol: 'POS-LONG', side: 'long', quantity: '2.00000000', entryPrice: '100.00000000', status: 'open', pnl: null });

      await setPrice('POS-LONG', '110.25');
      const closed = await authed(ctx, user, 'post', `/positions/${opened.body.id}/close`).expect(201);
      expect(closed.body).toMatchObject({ status: 'closed', closedPrice: '110.25000000', pnl: '20.50000000' });
    });

    it('short pnl is the other way around', async () => {
      await createAsset('POS-SHORT', '50');
      const user = ctx.newUser();
      const opened = await authed(ctx, user, 'post', '/positions').send({ symbol: 'POS-SHORT', side: 'short', quantity: '10' }).expect(201);
      await setPrice('POS-SHORT', '45.5');
      const closed = await authed(ctx, user, 'post', `/positions/${opened.body.id}/close`).expect(201);
      expect(closed.body.pnl).toBe('45.00000000');
    });

    it('refuses halted, delisted and unknown assets', async () => {
      await createAsset('POS-HALT', '10', { status: 'halted' });
      await createAsset('POS-DELIST', '10', { status: 'delisted' });
      const user = ctx.newUser();
      expect((await authed(ctx, user, 'post', '/positions').send({ symbol: 'POS-HALT', side: 'long', quantity: '1' })).body.code).toBe('ASSET_NOT_TRADABLE');
      await authed(ctx, user, 'post', '/positions').send({ symbol: 'POS-DELIST', side: 'long', quantity: '1' }).expect(409);
      await authed(ctx, user, 'post', '/positions').send({ symbol: 'GHOST', side: 'long', quantity: '1' }).expect(404);
      await authed(ctx, user, 'post', '/positions').send({ symbol: 'POS-HALT', side: 'sideways', quantity: '1' }).expect(400);
      await authed(ctx, user, 'post', '/positions').send({ symbol: 'POS-HALT', side: 'long', quantity: 1.5 }).expect(400);
      await createAsset('POS-QTY', '10');
      await authed(ctx, user, 'post', '/positions').send({ symbol: 'POS-QTY', side: 'long', quantity: '0' }).expect(422);
    });

    it('closing twice fails, also when both requests arrive at the same time', async () => {
      await createAsset('POS-RACE', '10');
      const user = ctx.newUser();
      const opened = await authed(ctx, user, 'post', '/positions').send({ symbol: 'POS-RACE', side: 'long', quantity: '1' }).expect(201);

      const results = await Promise.all([1, 2, 3, 4].map(() => authed(ctx, user, 'post', `/positions/${opened.body.id}/close`)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(3);
    });

    it('shows and closes only own positions', async () => {
      await createAsset('POS-OWN', '10');
      const owner = ctx.newUser();
      const other = ctx.newUser();
      const opened = await authed(ctx, owner, 'post', '/positions').send({ symbol: 'POS-OWN', side: 'long', quantity: '1' }).expect(201);

      expect((await authed(ctx, other, 'get', '/positions').expect(200)).body.total).toBe(0);
      await authed(ctx, other, 'post', `/positions/${opened.body.id}/close`).expect(404);
      expect((await authed(ctx, owner, 'get', '/positions').expect(200)).body.total).toBe(1);
    });

    it('lists with filters and pagination', async () => {
      await createAsset('POS-LIST', '10');
      const user = ctx.newUser();
      for (const side of ['long', 'long', 'short']) {
        await authed(ctx, user, 'post', '/positions').send({ symbol: 'POS-LIST', side, quantity: '1' }).expect(201);
      }
      const all = await authed(ctx, user, 'get', '/positions').expect(200);
      await authed(ctx, user, 'post', `/positions/${all.body.items[0].id}/close`).expect(201);

      expect((await authed(ctx, user, 'get', '/positions?status=open').expect(200)).body.total).toBe(2);
      expect((await authed(ctx, user, 'get', '/positions?status=closed').expect(200)).body.total).toBe(1);
      expect((await authed(ctx, user, 'get', '/positions?side=short').expect(200)).body.total).toBe(1);
      expect((await authed(ctx, user, 'get', '/positions?symbol=pos-list').expect(200)).body.total).toBe(3);
      const page = await authed(ctx, user, 'get', '/positions?pageSize=2&page=2').expect(200);
      expect(page.body.items).toHaveLength(1);
    });

    it('summary: realized pnl from closed positions, unrealized from the current price (native SQL)', async () => {
      await createAsset('SUM-A', '100');
      await createAsset('SUM-B', '10');
      const user = ctx.newUser();

      const closedLong = await authed(ctx, user, 'post', '/positions').send({ symbol: 'SUM-A', side: 'long', quantity: '2' }).expect(201);
      await setPrice('SUM-A', '105');
      await authed(ctx, user, 'post', `/positions/${closedLong.body.id}/close`).expect(201); // realized +10
      await authed(ctx, user, 'post', '/positions').send({ symbol: 'SUM-A', side: 'short', quantity: '3' }).expect(201); // opened at 105
      await authed(ctx, user, 'post', '/positions').send({ symbol: 'SUM-B', side: 'long', quantity: '1.5' }).expect(201);
      await setPrice('SUM-A', '100'); // short gains 5 * 3 = 15
      await setPrice('SUM-B', '12'); // long gains 2 * 1.5 = 3

      const summary = await authed(ctx, user, 'get', '/positions/summary').expect(200);
      expect(summary.body).toEqual([
        { symbol: 'SUM-A', openCount: 1, closedCount: 1, openQuantity: '3.00000000', realizedPnl: '10.00000000', unrealizedPnl: '15.00000000' },
        { symbol: 'SUM-B', openCount: 1, closedCount: 0, openQuantity: '1.50000000', realizedPnl: '0.00000000', unrealizedPnl: '3.00000000' },
      ]);
      expect((await authed(ctx, ctx.newUser(), 'get', '/positions/summary').expect(200)).body).toEqual([]);
    });
  });

  describe('prices and candles', () => {
    it('the simulator moves active assets with one bulk update and stores ticks', async () => {
      await createAsset('SIM-A', '100');
      await createAsset('SIM-B', '50', { status: 'halted' });
      const before = await ctx.sql(`SELECT symbol, last_price, updated_at FROM assets WHERE symbol IN ('SIM-A', 'SIM-B') ORDER BY symbol`);

      await ctx.sql(`DELETE FROM price_ticks`);
      const count = await ctx.app.get(SimulatePricesUseCase).execute();
      expect(count).toBeGreaterThanOrEqual(1);

      const after = await ctx.sql(`SELECT symbol, last_price, updated_at FROM assets WHERE symbol IN ('SIM-A', 'SIM-B') ORDER BY symbol`);
      expect(after[1].last_price).toBe(before[1].last_price); // halted: untouched
      const ticks = await ctx.sql(`SELECT a.symbol, t.price FROM price_ticks t JOIN assets a ON a.id = t.asset_id WHERE a.symbol = 'SIM-A'`);
      expect(ticks).toHaveLength(1);
      expect(ticks[0].price).toBe(after[0].last_price); // the tick and the asset agree
      const ratio = Number(after[0].last_price) / 100;
      expect(ratio).toBeGreaterThan(0.994);
      expect(ratio).toBeLessThan(1.006);
    });

    it('builds OHLC candles from ticks (window functions)', async () => {
      const asset = await createAsset('CAN-A', '100');
      const base = '2026-03-01T10:';
      const ticks: [string, string][] = [
        [`${base}00:05Z`, '100'], [`${base}00:30Z`, '105'], [`${base}00:50Z`, '98'], [`${base}00:55Z`, '101'], // minute 10:00
        [`${base}01:10Z`, '102'], [`${base}01:40Z`, '103'], // minute 10:01
        [`${base}07:00Z`, '90'], // 5 minute bucket 10:05
      ];
      for (const [ts, price] of ticks) {
        await ctx.sql(`INSERT INTO price_ticks (asset_id, price, ts) VALUES ($1, $2, $3)`, [asset.id, price, ts]);
      }
      const query = (interval: string) =>
        authed(ctx, ctx.newUser(), 'get', `/assets/can-a/candles?interval=${interval}&from=2026-03-01T00:00:00Z&to=2026-03-02T00:00:00Z`).expect(200);

      const minutes = await query('1m');
      expect(minutes.body).toEqual([
        { bucket: '2026-03-01T10:00:00.000Z', open: '100.00000000', high: '105.00000000', low: '98.00000000', close: '101.00000000', ticks: 4 },
        { bucket: '2026-03-01T10:01:00.000Z', open: '102.00000000', high: '103.00000000', low: '102.00000000', close: '103.00000000', ticks: 2 },
        { bucket: '2026-03-01T10:07:00.000Z', open: '90.00000000', high: '90.00000000', low: '90.00000000', close: '90.00000000', ticks: 1 },
      ]);

      const fiveMinutes = await query('5m');
      expect(fiveMinutes.body).toEqual([
        { bucket: '2026-03-01T10:00:00.000Z', open: '100.00000000', high: '105.00000000', low: '98.00000000', close: '103.00000000', ticks: 6 },
        { bucket: '2026-03-01T10:05:00.000Z', open: '90.00000000', high: '90.00000000', low: '90.00000000', close: '90.00000000', ticks: 1 },
      ]);

      const hour = await query('1h');
      expect(hour.body).toHaveLength(1);
      expect(hour.body[0]).toMatchObject({ open: '100.00000000', close: '90.00000000', high: '105.00000000', low: '90.00000000', ticks: 7 });
      const daily = await query('1d');
      expect(daily.body).toHaveLength(1);
      expect(daily.body[0].bucket).toBe('2026-03-01T00:00:00.000Z');
      expect((await query('15m')).body).toHaveLength(1);

      await authed(ctx, ctx.newUser(), 'get', '/assets/can-a/candles?interval=2m').expect(400);
      await authed(ctx, ctx.newUser(), 'get', '/assets/nosuch/candles?interval=1m').expect(404);
    });
  });

  describe('websocket /market', () => {
    const connect = (cookie?: string): Socket =>
      io(`http://127.0.0.1:${ctx.port}/market`, {
        transports: ['websocket'],
        reconnection: false,
        extraHeaders: cookie ? { cookie } : undefined,
      });

    const once = <T>(socket: Socket, event: string, timeoutMs = 3000): Promise<T> =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
        socket.once(event, (data: T) => {
          clearTimeout(timer);
          resolve(data);
        });
      });

    it('refuses a connection without the access_token cookie', async () => {
      const socket = connect();
      const error = await once<Error>(socket, 'connect_error');
      expect(error.message).toBe('unauthorized');
      socket.close();
    });

    it('refuses a bad token', async () => {
      const socket = connect('access_token=not-a-jwt');
      expect((await once<Error>(socket, 'connect_error')).message).toBe('unauthorized');
      socket.close();
    });

    it('sends batched ticks only for subscribed symbols', async () => {
      await createAsset('WS-A', '100');
      await createAsset('WS-B', '100');
      const socket = connect(ctx.newUser().accessCookie);
      await once(socket, 'connect');

      const subscribed = once<{ symbols: string[] }>(socket, 'subscribed');
      socket.emit('subscribe', { symbols: ['ws-a'] });
      expect((await subscribed).symbols).toEqual(['WS-A']);

      const received: { symbol: string; price: string }[][] = [];
      socket.on('ticks', (batch) => received.push(batch));
      const firstBatch = once<{ symbol: string; price: string; ts: string }[]>(socket, 'ticks');

      await ctx.app.get(SimulatePricesUseCase).execute();
      const batch = await firstBatch;
      expect(batch.map((tick) => tick.symbol)).toEqual(['WS-A']);
      expect(batch[0].price).toMatch(/^\d+\.\d{8}$/);

      // Unsubscribe: the next round must not reach this client.
      socket.emit('unsubscribe', { symbols: ['WS-A'] });
      await once(socket, 'subscribed');
      const countBefore = received.length;
      await ctx.app.get(SimulatePricesUseCase).execute();
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(received.length).toBe(countBefore);
      socket.close();
    });

    it('batches many rounds inside one 250 ms window into one message', async () => {
      await createAsset('WS-C', '100');
      const socket = connect(ctx.newUser().accessCookie);
      await once(socket, 'connect');
      socket.emit('subscribe', { symbols: ['WS-C'] });
      await once(socket, 'subscribed');

      const messages: unknown[] = [];
      socket.on('ticks', (batch) => messages.push(batch));
      const gateway = ctx.app.get(MarketGateway);
      const now = new Date();
      for (let i = 0; i < 5; i++) {
        gateway.publish([{ assetId: 'x', symbol: 'WS-C', price: `${100 + i}.00000000`, ts: now }]);
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
      expect(messages).toHaveLength(1);
      expect((messages[0] as { price: string }[])[0].price).toBe('104.00000000');
      socket.close();
    });
  });

  it('serves swagger and health', async () => {
    await ctx.http().get('/docs-json').expect(200);
    await ctx.http().get(`/api/market/health`).expect(200);
  });
});
