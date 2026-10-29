# Endpoints

All paths are shown as the gateway serves them (http://localhost:8080). Every service also listens on its own port and has Swagger at `/docs`.

"Auth" means a valid `access_token` cookie. "CSRF" means the `X-CSRF-Token` header must match the `csrf_token` cookie (POST, PUT, PATCH, DELETE only). List endpoints accept `page` (default 1) and `pageSize` (default 20, max 100).

## Identity service (port 3001)

| Method | Path | Auth | Role | CSRF | Description |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/identity/auth/register` | no | none | no | Create an account |
| POST | `/api/identity/auth/login` | no | none | no | Log in, set the three cookies |
| POST | `/api/identity/auth/refresh` | refresh cookie | none | yes | Rotate the refresh token, set new cookies |
| POST | `/api/identity/auth/logout` | no | none | yes | Revoke the token family, clear cookies |
| GET | `/api/identity/auth/me` | yes | any | no | The signed in user |
| PATCH | `/api/identity/users/me` | yes | any | yes | Update own display name |
| POST | `/api/identity/users/me/password` | yes | any | yes | Change own password, sign out everywhere |
| GET | `/api/identity/users` | yes | admin | no | List users, filters `q`, `role`, paginated |
| GET | `/api/identity/health` | no | none | no | Health check with a database ping |

## Wallet service (port 3002)

| Method | Path | Auth | Role | CSRF | Description |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/wallet/wallets/me` | yes | any | no | My wallet, created on first call |
| GET | `/api/wallet/wallets/me/ledger` | yes | any | no | My ledger, filters `kind`, `from`, `to`, paginated |
| POST | `/api/wallet/deposits` | yes | any | yes | Request a crypto deposit (BTC, ETH, USDT). Needs `Idempotency-Key` |
| GET | `/api/wallet/deposits` | yes | any | no | My deposits, paginated |
| GET | `/api/wallet/deposits/:id` | yes | any | no | One of my deposits |
| POST | `/api/wallet/webhooks/crypto` | HMAC signature | none | no | Provider webhook. Header `X-Signature`. Confirms a deposit once and credits the wallet |
| POST | `/api/wallet/dev/simulate-deposit` | yes | any | yes | Dev only (not in production). Signs and delivers a webhook to this service |
| POST | `/api/wallet/transfers` | yes | any | yes | Atomic transfer to `recipientUserId`. Needs `Idempotency-Key` |
| GET | `/api/wallet/transfers` | yes | any | no | My transfers (sent and received), paginated |
| GET | `/api/wallet/transfers/:id` | yes | any | no | One of my transfers |
| GET | `/api/wallet/reports/volume` | yes | any | no | Transfer volume per day with a running total, filters `from`, `to` |
| GET | `/api/wallet/health` | no | none | no | Health check with a database ping |

## Market service (port 3003)

| Method | Path | Auth | Role | CSRF | Description |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/market/assets` | yes | any | no | Search assets: `q`, `category`, `status`, `minPrice`, `maxPrice`, `sort`, `order`, paginated |
| GET | `/api/market/assets/:symbol` | yes | any | no | One asset by symbol |
| GET | `/api/market/assets/:symbol/candles` | yes | any | no | OHLC candles: `interval` (1m, 5m, 15m, 1h, 1d), `from`, `to`, `limit` |
| POST | `/api/market/assets` | yes | admin | yes | Create an asset |
| PATCH | `/api/market/assets/:id` | yes | admin | yes | Update name, category or status |
| POST | `/api/market/assets/bulk` | yes | admin | yes | Upsert up to 500 assets by symbol, returns `created` and `updated` |
| POST | `/api/market/assets/bulk/status` | yes | admin | yes | Set the status of many assets, all or nothing, returns `affected` |
| DELETE | `/api/market/assets/bulk` | yes | admin | yes | Soft delete many assets, returns `affected` |
| POST | `/api/market/positions` | yes | any | yes | Open a long or short position at the current price (active assets only) |
| POST | `/api/market/positions/:id/close` | yes | any | yes | Close my position at the current price and compute pnl |
| GET | `/api/market/positions` | yes | any | no | My positions, filters `status`, `side`, `symbol`, paginated |
| GET | `/api/market/positions/summary` | yes | any | no | Realized and unrealized pnl per asset |
| GET | `/api/market/health` | no | none | no | Health check with a database ping |

### Socket.io (market service)

| Namespace | Auth | Client sends | Server sends | Description |
| --- | --- | --- | --- | --- |
| `/market` (path `/socket.io/`) | `access_token` cookie in the handshake | `subscribe` and `unsubscribe` with `{ symbols: [...] }` | `subscribed` (current list), `ticks` (batch every 250 ms) | Live prices for the subscribed symbols |
