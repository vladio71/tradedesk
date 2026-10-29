# TradeDesk

A backend for a small trading platform. It has crypto deposits, internal transfers between users, live market prices and bulk asset management.

It is three NestJS services in one npm workspaces monorepo. Each service owns its own database. They talk to the client over HTTP and socket.io, and they trust each other only through a signed JWT.

## What it does

* **Identity service**: sign up, log in, refresh sessions, roles (`user`, `admin`).
* **Wallet service**: one USD wallet per user, a double-entry style ledger, crypto deposits (BTC, ETH, USDT) with a signed webhook, atomic internal transfers, a volume report.
* **Market service**: assets, bulk asset operations, positions with pnl, OHLC candles, live prices over socket.io.

## Architecture

```
                 browser / client
                       |
              nginx gateway :8080
     /api/identity/  /api/wallet/  /api/market/  /socket.io/
          |              |              |
   identity-service  wallet-service  market-service
       :3001            :3002          :3003
          |              |              |
      db identity     db wallet      db market        (one Postgres 16, three databases)
```

Rules:

* Three bounded contexts, three services, three databases. A service never reads another service's database.
* The only thing they share is the access token (a JWT signed with HS256 and a secret from the environment). The wallet and market services only verify it. They never call the identity service.
* Because of that, the wallet service does not know whether a `recipientUserId` really exists. It creates a wallet for any valid user id. A real system would add an event or a lookup.

### Folders

```
apps/
  identity-service/
  wallet-service/
  market-service/
libs/
  common/            config loading, cookie JWT guard, roles guard, CSRF guard,
                     exception filter, pagination helpers, request id logging
docker/              postgres init script, nginx config
scripts/             seed.ts, smoke.sh
```

Inside every service the code is split in four layers:

```
src/domain           aggregates, entities, value objects, domain errors, repository interfaces. No framework imports.
src/application      one class per use case
src/infrastructure   TypeORM entities, repository implementations, migrations, adapters
src/interfaces/http  controllers, DTOs, mappers
```

A use case talks to repository interfaces from the domain. The TypeORM classes in infrastructure implement them. Use cases run inside a `UnitOfWork` (a small transaction helper), so unit tests can swap the database for in-memory fakes.

### Where native SQL is used

TypeORM repositories do plain reads and CRUD. Native SQL (`manager.query`) is used when the SQL itself is the point:

| Place | Why |
| --- | --- |
| Refresh token rotation | `SELECT ... FOR UPDATE` on the token row |
| Wallet locking in transfers | `SELECT ... ORDER BY id FOR UPDATE` on both wallets, and `UPDATE` of the balance |
| Deposit webhook | `SELECT ... FOR UPDATE` on the deposit row |
| Volume report | `date_trunc`, `SUM`, running total with a window function |
| Price simulator | one `UPDATE ... FROM (VALUES ...)` for all assets |
| Bulk upsert | one `INSERT ... ON CONFLICT DO UPDATE` |
| Bulk status and delete | `UPDATE ... WHERE id = ANY($1)` |
| Candles | `date_trunc` buckets and `FIRST_VALUE` window functions |
| Position summary | `GROUP BY` with `FILTER` |

### Money

Money is never a JS float. In the wallet it is a `Money` value object on top of decimal.js. In the market service it is a `Decimal8` value object. The API sends and receives decimal strings such as `"12.50000000"`. A JSON number for an amount is rejected. The database uses `numeric(20,8)`, and the wallet has `CHECK (balance >= 0)`.

### Consistency rules

* **Transfers** run in one transaction. Both wallet rows are locked with `FOR UPDATE` in the same order (by wallet id), so two opposite transfers cannot deadlock. The balance is checked after the lock. Two ledger entries are written with `balance_after`.
* **Idempotency-Key** is required on `POST /deposits` and `POST /transfers`. The same key returns the first result (status 200 and the header `Idempotent-Replayed: true`). The same key with a different body gives 409. A unique index on `(user, key)` is the safety net.
* **Webhooks** are verified with HMAC-SHA256 (timing-safe compare) over the raw body. The deposit row is locked, so a webhook that arrives twice, even at the same moment, credits the wallet once. A unique index on the ledger is a second safety net.
* **Positions** are closed under a row lock. Closing twice gives 409.
* **Bulk status** is all or nothing. If one id does not exist, the transaction rolls back.

## Auth flow

1. `POST /api/identity/auth/login` checks the password (bcryptjs) and sets three cookies:

   | Cookie | Content | Flags |
   | --- | --- | --- |
   | `access_token` | JWT (HS256), 15 minutes | httpOnly, SameSite=Lax, path `/`, Secure when `COOKIE_SECURE=true` |
   | `refresh_token` | random opaque string, 7 days | httpOnly, SameSite=Lax, path `/api/identity/auth`, Secure when `COOKIE_SECURE=true` |
   | `csrf_token` | random string | readable by JavaScript, SameSite=Lax, path `/` |

2. Every service reads `access_token` from the cookie, verifies the JWT and puts `{ id, email, role }` on the request. Admin routes use `@Roles('admin')`, which checks the role claim.
3. **CSRF** uses the double submit cookie pattern. For POST, PUT, PATCH and DELETE the client must send the value of the `csrf_token` cookie in the `X-CSRF-Token` header. Login and register are exempt. The provider webhook is exempt too, because it is signed instead.
4. When the access token expires, the client calls `POST /auth/refresh`. The browser sends the refresh cookie only to that path.
5. **Rotation**: the refresh token is stored as a SHA-256 hash. On every refresh the old row is locked with `SELECT ... FOR UPDATE`, a new token is inserted in the same family, and the old one is marked revoked. All of this is one transaction.
6. **Reuse detection**: if a revoked token is presented again, the whole family is revoked and the request fails with 401. The revocation is committed, not rolled back. Two parallel refreshes with the same token also count as reuse, so only one of them can win.
7. Logout revokes the family and clears the cookies. Changing the password revokes all refresh tokens of the user.

In production use asymmetric keys: the identity service signs with a private key (RS256 or EdDSA) and the other services verify with the public key only. Here one shared secret keeps the demo small, and any service holding it could forge tokens.

## Realtime prices

The market service has a socket.io namespace `/market`. The handshake must carry the `access_token` cookie, otherwise the connection is refused with `unauthorized`.

```js
const socket = io('http://localhost:8080/market', { withCredentials: true });
socket.emit('subscribe', { symbols: ['BTC', 'ETH'] });
socket.on('ticks', (batch) => console.log(batch)); // [{ symbol, price, ts }]
socket.emit('unsubscribe', { symbols: ['ETH'] });
```

Ticks are collected and sent every 250 ms, only for the symbols a client subscribed to. If a symbol ticked several times inside one window, only the newest tick is sent.

The price simulator (`PRICE_SIMULATOR_ENABLED=true`) moves every active asset by at most 0.5 percent every second, using one bulk SQL update, and stores a row in `price_ticks`.

## Run with docker compose

You need Docker with Compose.

```bash
docker compose up --build
```

This starts Postgres (creating the `identity`, `wallet` and `market` databases), the three services, and the nginx gateway. Services start only after Postgres is healthy, and the gateway starts after the services are healthy. Services run their TypeORM migrations on startup.

* Gateway: http://localhost:8080
* Swagger per service: http://localhost:3001/docs, http://localhost:3002/docs, http://localhost:3003/docs

Seed data (an admin, two users, 8 assets, funded wallets):

```bash
docker compose --profile seed run --rm seed
```

| Email | Password | Role | Balance |
| --- | --- | --- | --- |
| admin@tradedesk.dev | Admin12345! | admin | 1000 |
| alice@tradedesk.dev | Password123! | user | 10000 |
| bob@tradedesk.dev | Password123! | user | 2500 |

Then try the walkthrough:

```bash
./scripts/smoke.sh
```

You can also use `requests.http` with the VS Code REST Client extension.

## Run locally without docker

You need Node 22 and a Postgres 16 server.

```bash
# 1. databases
psql -U postgres -f docker/postgres/init.sql      # creates identity, wallet, market
# (or create the three databases and a user yourself, then edit the URLs in .env)

# 2. config
cp .env.example .env

# 3. install and build
npm install
npm run build

# 4. start the services, one terminal each
npm run start:identity
npm run start:wallet
npm run start:market

# 5. seed data
npm run seed

# 6. walkthrough, straight to the services (no gateway)
IDENTITY_URL=http://localhost:3001 WALLET_URL=http://localhost:3002 MARKET_URL=http://localhost:3003 ./scripts/smoke.sh
```

## Environment variables

| Variable | Used by | Default | Meaning |
| --- | --- | --- | --- |
| `NODE_ENV` | all | `development` | `production` removes `POST /dev/simulate-deposit` |
| `JWT_SECRET` | all | none, required | HS256 secret, at least 16 characters, the same in all services |
| `ACCESS_TOKEN_TTL_SECONDS` | all | `900` | Access token and cookie lifetime |
| `REFRESH_TOKEN_TTL_SECONDS` | identity | `604800` | Refresh token and cookie lifetime |
| `COOKIE_SECURE` | all | `false` | Set `true` behind https. `false` makes cookies work on http://localhost |
| `IDENTITY_DATABASE_URL` | identity | none, required | Postgres URL of the identity database |
| `WALLET_DATABASE_URL` | wallet | none, required | Postgres URL of the wallet database |
| `MARKET_DATABASE_URL` | market | none, required | Postgres URL of the market database |
| `IDENTITY_PORT`, `WALLET_PORT`, `MARKET_PORT` | each | `3001`, `3002`, `3003` | HTTP ports |
| `CRYPTO_WEBHOOK_SECRET` | wallet | none, required | HMAC secret shared with the crypto provider |
| `PRICE_SIMULATOR_ENABLED` | market | `false` (compose: `true`) | Random walk prices |
| `PRICE_SIMULATOR_INTERVAL_MS` | market | `1000` | Simulator period |

## Tests

```bash
npm test            # unit tests, no database needed
npm run test:e2e    # e2e tests, need a real Postgres (see below)
```

Unit tests cover the domain (Money, Wallet, Transfer, Deposit, Position pnl, price walk, tick batching) and the use cases, with in-memory fake repositories.

E2E tests boot the real Nest apps with supertest against a real Postgres. Each test file creates its own throwaway database and runs the real migrations. Set `E2E_PG_URL` to any database on a server where you may create databases. The default is `postgres://postgres@127.0.0.1:54329/postgres`.

```bash
E2E_PG_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:e2e
```

No Postgres at hand? Start a temporary one (`initdb` refuses to run as root, so use another user):

```bash
initdb -D /tmp/pgdata -A trust -U postgres
pg_ctl -D /tmp/pgdata -o "-p 54329 -c listen_addresses=127.0.0.1" -l /tmp/pg.log start
npm run test:e2e
```

What the e2e suites prove:

* register, login, cookie flags, CSRF, `me`, admin listing with filters
* refresh rotation, reuse detection with family revoke, parallel refresh with one winner
* deposits with Idempotency-Key, dev simulator over real HTTP
* the same webhook delivered twice, and 8 times at once: one credit
* the same transfer key twice: one transfer
* 20 parallel transfers from a wallet that can pay for 5: exactly 5 succeed, the balance is never negative
* opposite transfers at the same time: no deadlock
* bulk upsert of 500 rows, all-or-nothing status change, soft delete, positions, pnl, candles
* socket.io: auth by cookie, subscribe, unsubscribe, batching

## Good to know

* Prices live in `price_ticks`, which grows every second per active asset. A real system would partition it or roll it up.
* Day buckets in the report and in candles are cut in UTC, because the connection sets `TimeZone=UTC`.
* NestJS 11 is used, not 12, because NestJS 12 packages are ESM only and this project compiles to CommonJS.
* `npm audit` reports issues in `multer`, a dependency of `@nestjs/platform-express`. This project has no file upload routes.
