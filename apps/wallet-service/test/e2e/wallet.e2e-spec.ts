import { randomUUID } from 'node:crypto';
import { api, authed, bootWallet, TestApp } from './support';

describe('Wallet service (e2e, real Postgres)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await bootWallet();
  });

  afterAll(async () => {
    await ctx.close();
  });

  const balanceOf = async (user: { id: string }) =>
    ((await ctx.sql(`SELECT balance FROM wallets WHERE user_id = $1`, [user.id]))[0]?.balance as string | undefined) ?? 'no wallet';

  describe('wallet', () => {
    it('needs a signed in user', async () => {
      await ctx.http().get(`${api}/wallets/me`).expect(401);
    });

    it('is created on first request with a zero balance', async () => {
      const user = ctx.newUser();
      const response = await authed(ctx, user, 'get', '/wallets/me').expect(200);
      expect(response.body).toMatchObject({ userId: user.id, balance: '0.00000000' });
      expect(await balanceOf(user)).toBe('0.00000000');
    });

    it('database refuses a negative balance (CHECK constraint)', async () => {
      const user = ctx.newUser();
      await authed(ctx, user, 'get', '/wallets/me').expect(200);
      await expect(ctx.sql(`UPDATE wallets SET balance = -0.00000001 WHERE user_id = $1`, [user.id])).rejects.toThrow(/ck_wallets_balance_non_negative/);
    });
  });

  describe('deposits', () => {
    it('requires CSRF and an Idempotency-Key', async () => {
      const user = ctx.newUser();
      await ctx.http().post(`${api}/deposits`).set('Cookie', user.cookie).set('Idempotency-Key', 'key-00000001').send({ asset: 'BTC', amount: '1' }).expect(403);
      const missingKey = await authed(ctx, user, 'post', '/deposits').send({ asset: 'BTC', amount: '1' });
      expect(missingKey.status).toBe(400);
      const shortKey = await authed(ctx, user, 'post', '/deposits', 'short').send({ asset: 'BTC', amount: '1' });
      expect(shortKey.status).toBe(400);
    });

    it('validates asset and amount (no floats)', async () => {
      const user = ctx.newUser();
      await authed(ctx, user, 'post', '/deposits', 'key-00000002').send({ asset: 'DOGE', amount: '1' }).expect(400);
      await authed(ctx, user, 'post', '/deposits', 'key-00000003').send({ asset: 'BTC', amount: 0.1 }).expect(400);
      await authed(ctx, user, 'post', '/deposits', 'key-00000004').send({ asset: 'BTC', amount: '1.123456789' }).expect(400);
      await authed(ctx, user, 'post', '/deposits', 'key-00000005').send({ asset: 'BTC', amount: '0' }).expect(422);
    });

    it('creates a pending deposit and returns the same one for the same key', async () => {
      const user = ctx.newUser();
      const first = await authed(ctx, user, 'post', '/deposits', 'key-deposit-1').send({ asset: 'BTC', amount: '0.015' });
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({ status: 'pending', asset: 'BTC', amount: '0.01500000', usdRate: '60000.00000000', creditAmount: '900.00000000' });
      expect(first.body.address).toMatch(/^bc1q/);

      const again = await authed(ctx, user, 'post', '/deposits', 'key-deposit-1').send({ asset: 'BTC', amount: '0.015' });
      expect(again.status).toBe(200);
      expect(again.headers['idempotent-replayed']).toBe('true');
      expect(again.body.id).toBe(first.body.id);

      const different = await authed(ctx, user, 'post', '/deposits', 'key-deposit-1').send({ asset: 'BTC', amount: '0.02' });
      expect(different.status).toBe(409);

      const list = await authed(ctx, user, 'get', '/deposits').expect(200);
      expect(list.body.total).toBe(1);
    });

    it('parallel requests with the same key create one deposit', async () => {
      const user = ctx.newUser();
      const results = await Promise.all(
        Array.from({ length: 6 }, () => authed(ctx, user, 'post', '/deposits', 'key-parallel-1').send({ asset: 'ETH', amount: '1' })),
      );
      expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);
      expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
      const rows = await ctx.sql(`SELECT count(*)::int AS n FROM deposits WHERE user_id = $1`, [user.id]);
      expect(rows[0].n).toBe(1);
    });

    it("does not show another user's deposit", async () => {
      const owner = ctx.newUser();
      const stranger = ctx.newUser();
      const created = await authed(ctx, owner, 'post', '/deposits', 'key-private-1').send({ asset: 'USDT', amount: '5' }).expect(201);
      await authed(ctx, owner, 'get', `/deposits/${created.body.id}`).expect(200);
      await authed(ctx, stranger, 'get', `/deposits/${created.body.id}`).expect(404);
    });

    it('confirms through the dev simulator: signed webhook over HTTP, wallet credited, ledger written', async () => {
      const user = ctx.newUser();
      const created = await authed(ctx, user, 'post', '/deposits', 'key-sim-0001').send({ asset: 'BTC', amount: '0.01' }).expect(201);

      const simulated = await authed(ctx, user, 'post', '/dev/simulate-deposit').send({ depositId: created.body.id }).expect(201);
      expect(simulated.body).toEqual({ webhookStatus: 200, webhookResponse: { status: 'confirmed' } });

      expect(await balanceOf(user)).toBe('600.00000000');
      const deposit = await authed(ctx, user, 'get', `/deposits/${created.body.id}`).expect(200);
      expect(deposit.body.status).toBe('confirmed');
      expect(deposit.body.txHash).toBeTruthy();

      const ledger = await authed(ctx, user, 'get', '/wallets/me/ledger').expect(200);
      expect(ledger.body.items).toHaveLength(1);
      expect(ledger.body.items[0]).toMatchObject({ kind: 'deposit', direction: 'credit', amount: '600.00000000', balanceAfter: '600.00000000' });
    });
  });

  describe('crypto webhook', () => {
    async function pendingDeposit(user = ctx.newUser(), amount = '25') {
      const created = await authed(ctx, user, 'post', '/deposits', `key-${randomUUID()}`).send({ asset: 'USDT', amount }).expect(201);
      const body = { eventId: randomUUID(), type: 'deposit.confirmed', address: created.body.address, asset: 'USDT', amount: created.body.amount, txHash: 'tx-1' };
      return { user, created: created.body, body, ...ctx.signedWebhook(body) };
    }

    const post = (raw: string, signature?: string) => {
      const call = ctx.http().post(`${api}/webhooks/crypto`).set('Content-Type', 'application/json');
      if (signature !== undefined) call.set('X-Signature', signature);
      return call.send(raw);
    };

    it('rejects a missing, wrong or tampered signature and credits nothing', async () => {
      const { user, raw, signature, body } = await pendingDeposit();
      expect((await post(raw)).status).toBe(401);
      expect((await post(raw, 'abcd')).status).toBe(401);
      expect((await post(raw, 'z'.repeat(64))).status).toBe(401);
      const tampered = JSON.stringify({ ...body, amount: '999999' });
      expect((await post(tampered, signature)).status).toBe(401);
      expect(await balanceOf(user)).toBe('0.00000000');
      const rows = await ctx.sql(`SELECT status FROM deposits WHERE user_id = $1`, [user.id]);
      expect(rows[0].status).toBe('pending');
    });

    it('does not need a cookie or a CSRF token', async () => {
      const { raw, signature } = await pendingDeposit();
      expect((await post(raw, signature)).status).toBe(200);
    });

    it('unknown address gives 404, a wrong amount gives 422', async () => {
      const unknown = ctx.signedWebhook({ eventId: 'e', type: 'deposit.confirmed', address: '0xunknown', asset: 'USDT', amount: '1', txHash: 't' });
      expect((await post(unknown.raw, unknown.signature)).status).toBe(404);

      const { body } = await pendingDeposit();
      const wrong = ctx.signedWebhook({ ...body, amount: '24' });
      expect((await post(wrong.raw, wrong.signature)).status).toBe(422);
    });

    it('credits once when the same webhook is delivered twice', async () => {
      const { user, raw, signature } = await pendingDeposit(ctx.newUser(), '40');
      const first = await post(raw, signature);
      const second = await post(raw, signature);
      expect(first.body).toEqual({ status: 'confirmed' });
      expect(second.body).toEqual({ status: 'already_processed' });
      expect(await balanceOf(user)).toBe('40.00000000');
      const ledger = await ctx.sql(`SELECT count(*)::int AS n FROM ledger_entries l JOIN wallets w ON w.id = l.wallet_id WHERE w.user_id = $1`, [user.id]);
      expect(ledger[0].n).toBe(1);
    });

    it('credits once when the same webhook is delivered many times at the same moment', async () => {
      const { user, raw, signature } = await pendingDeposit(ctx.newUser(), '70');
      const responses = await Promise.all(Array.from({ length: 8 }, () => post(raw, signature)));

      expect(responses.every((response) => response.status === 200)).toBe(true);
      expect(responses.filter((response) => response.body.status === 'confirmed')).toHaveLength(1);
      expect(responses.filter((response) => response.body.status === 'already_processed')).toHaveLength(7);
      expect(await balanceOf(user)).toBe('70.00000000');
      const ledger = await ctx.sql(`SELECT count(*)::int AS n FROM ledger_entries l JOIN wallets w ON w.id = l.wallet_id WHERE w.user_id = $1`, [user.id]);
      expect(ledger[0].n).toBe(1);
    });
  });

  describe('transfers', () => {
    it('requires an Idempotency-Key and CSRF', async () => {
      const user = ctx.newUser();
      const other = ctx.newUser();
      const body = { recipientUserId: other.id, amount: '1' };
      expect((await authed(ctx, user, 'post', '/transfers').send(body)).status).toBe(400);
      expect((await ctx.http().post(`${api}/transfers`).set('Cookie', user.cookie).set('Idempotency-Key', 'key-xxxxxxxx').send(body)).status).toBe(403);
    });

    it('moves money atomically with matching ledger entries', async () => {
      const alice = ctx.newUser();
      const bob = ctx.newUser();
      await ctx.fund(alice, '100');

      const response = await authed(ctx, alice, 'post', '/transfers', 'key-transfer-1').send({ recipientUserId: bob.id, amount: '30.25', note: 'lunch' });
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ fromUserId: alice.id, toUserId: bob.id, amount: '30.25000000', direction: 'out', note: 'lunch' });

      expect(await balanceOf(alice)).toBe('69.75000000');
      expect(await balanceOf(bob)).toBe('30.25000000');

      const aliceLedger = await authed(ctx, alice, 'get', '/wallets/me/ledger?kind=transfer_out').expect(200);
      expect(aliceLedger.body.items).toHaveLength(1);
      expect(aliceLedger.body.items[0]).toMatchObject({ direction: 'debit', amount: '30.25000000', balanceAfter: '69.75000000', referenceId: response.body.id });

      const bobLedger = await authed(ctx, bob, 'get', '/wallets/me/ledger').expect(200);
      expect(bobLedger.body.items[0]).toMatchObject({ kind: 'transfer_in', direction: 'credit', balanceAfter: '30.25000000' });
    });

    it('same Idempotency-Key twice makes one transfer', async () => {
      const alice = ctx.newUser();
      const bob = ctx.newUser();
      await ctx.fund(alice, '100');
      const body = { recipientUserId: bob.id, amount: '10' };

      const first = await authed(ctx, alice, 'post', '/transfers', 'key-idem-0001').send(body);
      const second = await authed(ctx, alice, 'post', '/transfers', 'key-idem-0001').send(body);

      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.headers['idempotent-replayed']).toBe('true');
      expect(second.body.id).toBe(first.body.id);
      expect(await balanceOf(alice)).toBe('90.00000000');
      expect(await balanceOf(bob)).toBe('10.00000000');

      const list = await authed(ctx, alice, 'get', '/transfers').expect(200);
      expect(list.body.total).toBe(1);

      const changed = await authed(ctx, alice, 'post', '/transfers', 'key-idem-0001').send({ ...body, amount: '11' });
      expect(changed.status).toBe(409);
      expect(changed.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('same key sent in parallel still makes one transfer', async () => {
      const alice = ctx.newUser();
      const bob = ctx.newUser();
      await ctx.fund(alice, '100');
      const responses = await Promise.all(
        Array.from({ length: 6 }, () => authed(ctx, alice, 'post', '/transfers', 'key-idem-par1').send({ recipientUserId: bob.id, amount: '10' })),
      );
      expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
      expect(responses.filter((r) => r.status === 200)).toHaveLength(5);
      expect(await balanceOf(alice)).toBe('90.00000000');
    });

    it('refuses insufficient funds, self transfer and bad amounts, and changes nothing', async () => {
      const alice = ctx.newUser();
      const bob = ctx.newUser();
      await ctx.fund(alice, '10');

      const tooMuch = await authed(ctx, alice, 'post', '/transfers', 'key-big-00001').send({ recipientUserId: bob.id, amount: '10.00000001' });
      expect(tooMuch.status).toBe(422);
      expect(tooMuch.body.code).toBe('INSUFFICIENT_FUNDS');

      const self = await authed(ctx, alice, 'post', '/transfers', 'key-self-0001').send({ recipientUserId: alice.id, amount: '1' });
      expect(self.status).toBe(422);
      expect(self.body.code).toBe('SELF_TRANSFER');

      await authed(ctx, alice, 'post', '/transfers', 'key-zero-0001').send({ recipientUserId: bob.id, amount: '0' }).expect(422);
      await authed(ctx, alice, 'post', '/transfers', 'key-neg-00001').send({ recipientUserId: bob.id, amount: '-5' }).expect(400);
      await authed(ctx, alice, 'post', '/transfers', 'key-flt-00001').send({ recipientUserId: bob.id, amount: 1.5 }).expect(400);
      await authed(ctx, alice, 'post', '/transfers', 'key-uid-00001').send({ recipientUserId: 'not-a-uuid', amount: '1' }).expect(400);

      expect(await balanceOf(alice)).toBe('10.00000000');
      const transfers = await ctx.sql(`SELECT count(*)::int AS n FROM transfers WHERE from_user_id = $1`, [alice.id]);
      expect(transfers[0].n).toBe(0);
    });

    it('lists, paginates and shows transfers only to the two parties', async () => {
      const alice = ctx.newUser();
      const bob = ctx.newUser();
      const stranger = ctx.newUser();
      await ctx.fund(alice, '100');
      const ids: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const created = await authed(ctx, alice, 'post', '/transfers', `key-list-000${i}`).send({ recipientUserId: bob.id, amount: `${i}` }).expect(201);
        ids.push(created.body.id);
      }

      const page1 = await authed(ctx, alice, 'get', '/transfers?pageSize=2&page=1').expect(200);
      expect(page1.body).toMatchObject({ total: 3, totalPages: 2, page: 1, pageSize: 2 });
      expect(page1.body.items).toHaveLength(2);
      const page2 = await authed(ctx, alice, 'get', '/transfers?pageSize=2&page=2').expect(200);
      expect(page2.body.items).toHaveLength(1);

      const bobView = await authed(ctx, bob, 'get', `/transfers/${ids[0]}`).expect(200);
      expect(bobView.body.direction).toBe('in');
      await authed(ctx, stranger, 'get', `/transfers/${ids[0]}`).expect(404);
      await authed(ctx, stranger, 'get', `/transfers/not-a-uuid`).expect(400);
    });

    it('filters the ledger by date', async () => {
      const alice = ctx.newUser();
      await ctx.fund(alice, '5');
      const future = new Date(Date.now() + 86_400_000).toISOString();
      const none = await authed(ctx, alice, 'get', `/wallets/me/ledger?from=${encodeURIComponent(future)}`).expect(200);
      expect(none.body.total).toBe(0);
      const some = await authed(ctx, alice, 'get', `/wallets/me/ledger?to=${encodeURIComponent(future)}`).expect(200);
      expect(some.body.total).toBe(1);
      await authed(ctx, alice, 'get', '/wallets/me/ledger?kind=nope').expect(400);
    });

    it('reports daily volume with a running total (native SQL, window function)', async () => {
      const alice = ctx.newUser();
      const bob = ctx.newUser();
      await ctx.fund(alice, '100');
      await authed(ctx, alice, 'post', '/transfers', 'key-rep-00001').send({ recipientUserId: bob.id, amount: '10' }).expect(201);
      await authed(ctx, alice, 'post', '/transfers', 'key-rep-00002').send({ recipientUserId: bob.id, amount: '5.5' }).expect(201);
      // Move one transfer to an earlier day so the running total has two rows.
      await ctx.sql(
        `UPDATE transfers SET created_at = created_at - interval '2 days'
          WHERE id = (SELECT id FROM transfers WHERE from_user_id = $1 ORDER BY created_at LIMIT 1)`,
        [alice.id],
      );

      const report = await authed(ctx, alice, 'get', '/reports/volume').expect(200);
      expect(report.body).toHaveLength(2);
      // Days are cut at UTC midnight, whatever time zone the database server uses.
      expect(report.body[0].day).toMatch(/T00:00:00\.000Z$/);
      expect(report.body[0]).toMatchObject({ transfersCount: 1, volume: '10.00000000', runningTotal: '10.00000000' });
      expect(report.body[1]).toMatchObject({ transfersCount: 1, volume: '5.50000000', runningTotal: '15.50000000' });

      const bobReport = await authed(ctx, bob, 'get', '/reports/volume').expect(200);
      expect(bobReport.body).toHaveLength(2);
      await authed(ctx, alice, 'get', '/reports/volume?from=yesterday').expect(400);
    });
  });

  describe('concurrency', () => {
    it('20 parallel transfers from a wallet that can pay for 5: exactly 5 succeed and the balance never goes negative', async () => {
      const alice = ctx.newUser();
      const bob = ctx.newUser();
      await ctx.fund(alice, '50');

      const responses = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          authed(ctx, alice, 'post', '/transfers', `key-race-${String(i).padStart(4, '0')}`).send({ recipientUserId: bob.id, amount: '10' }),
        ),
      );

      const succeeded = responses.filter((response) => response.status === 201);
      const refused = responses.filter((response) => response.status === 422);
      expect(succeeded).toHaveLength(5);
      expect(refused).toHaveLength(15);
      expect(refused.every((response) => response.body.code === 'INSUFFICIENT_FUNDS')).toBe(true);

      expect(await balanceOf(alice)).toBe('0.00000000');
      expect(await balanceOf(bob)).toBe('50.00000000');
      const rows = await ctx.sql(`SELECT count(*)::int AS n FROM transfers WHERE from_user_id = $1`, [alice.id]);
      expect(rows[0].n).toBe(5);
      // Ledger: 1 deposit for alice, 5 debits for alice, 5 credits for bob.
      const ledger = await ctx.sql(`SELECT count(*)::int AS n FROM ledger_entries l JOIN wallets w ON w.id = l.wallet_id WHERE w.user_id IN ($1, $2)`, [alice.id, bob.id]);
      expect(ledger[0].n).toBe(11);
    });

    it('opposite transfers at the same time do not deadlock and keep the total money', async () => {
      const alice = ctx.newUser();
      const bob = ctx.newUser();
      await ctx.fund(alice, '100');
      await ctx.fund(bob, '100');

      const calls = Array.from({ length: 12 }, (_, i) => {
        const [from, to] = i % 2 === 0 ? [alice, bob] : [bob, alice];
        return authed(ctx, from, 'post', '/transfers', `key-cross-${String(i).padStart(4, '0')}`).send({ recipientUserId: to.id, amount: '1' });
      });
      const responses = await Promise.all(calls);

      expect(responses.every((response) => response.status === 201)).toBe(true);
      const total = await ctx.sql(`SELECT SUM(balance)::text AS total FROM wallets WHERE user_id IN ($1, $2)`, [alice.id, bob.id]);
      expect(total[0].total).toBe('200.00000000');
    });

    it('transfers to a user without a wallet create the wallet', async () => {
      const alice = ctx.newUser();
      const newcomer = ctx.newUser();
      await ctx.fund(alice, '10');
      expect(await balanceOf(newcomer)).toBe('no wallet');
      await authed(ctx, alice, 'post', '/transfers', 'key-newcomer1').send({ recipientUserId: newcomer.id, amount: '4' }).expect(201);
      expect(await balanceOf(newcomer)).toBe('4.00000000');
    });
  });

  it('serves swagger and health', async () => {
    await ctx.http().get('/docs-json').expect(200);
    await ctx.http().get(`${api}/health`).expect(200);
  });
});
