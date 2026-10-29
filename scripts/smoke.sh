#!/usr/bin/env bash
# Walkthrough with curl: register, login, deposit, webhook, transfer, assets, positions.
#
#   docker compose up --build        (in another terminal)
#   ./scripts/smoke.sh
#
# By default everything goes through the gateway on http://localhost:8080.
# Without the gateway, point the three URLs at the services:
#   IDENTITY_URL=http://localhost:3001 WALLET_URL=http://localhost:3002 MARKET_URL=http://localhost:3003 ./scripts/smoke.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
IDENTITY_URL="${IDENTITY_URL:-$BASE_URL}"
WALLET_URL="${WALLET_URL:-$BASE_URL}"
MARKET_URL="${MARKET_URL:-$BASE_URL}"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
ALICE_JAR="$WORK_DIR/alice.jar"
BOB_JAR="$WORK_DIR/bob.jar"

RUN_ID="$(date +%s)-$RANDOM"
ALICE_EMAIL="alice-$RUN_ID@example.com"
BOB_EMAIL="bob-$RUN_ID@example.com"
PASSWORD="password123"

step() { printf '\n== %s\n' "$1"; }

# Prints a field of a JSON document from stdin: echo '{"a":{"b":1}}' | field a.b
field() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v=JSON.parse(s);for(const k of process.argv[1].split("."))v=v?.[k];console.log(v===undefined?"":typeof v==="object"?JSON.stringify(v):v)})' "$1"
}

# The csrf_token cookie lives in the cookie jar. The API wants its value again in the X-CSRF-Token header.
csrf() { awk '$6 == "csrf_token" { print $7 }' "$1"; }

# post JAR URL JSON [extra curl args]
post() {
  local jar="$1" url="$2" body="$3"; shift 3
  curl -sS -X POST "$url" -b "$jar" -c "$jar" -H "Content-Type: application/json" -H "X-CSRF-Token: $(csrf "$jar")" -d "$body" "$@"
}
get() { curl -sS "$2" -b "$1" -c "$1"; }

step "1. Register two users"
curl -sS -X POST "$IDENTITY_URL/api/identity/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$ALICE_EMAIL\",\"password\":\"$PASSWORD\",\"displayName\":\"Alice\"}"; echo
curl -sS -X POST "$IDENTITY_URL/api/identity/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$BOB_EMAIL\",\"password\":\"$PASSWORD\",\"displayName\":\"Bob\"}"; echo

step "2. Log in (cookies are saved in a jar)"
curl -sS -X POST "$IDENTITY_URL/api/identity/auth/login" -c "$ALICE_JAR" -H "Content-Type: application/json" \
  -d "{\"email\":\"$ALICE_EMAIL\",\"password\":\"$PASSWORD\"}"; echo
curl -sS -X POST "$IDENTITY_URL/api/identity/auth/login" -c "$BOB_JAR" -H "Content-Type: application/json" \
  -d "{\"email\":\"$BOB_EMAIL\",\"password\":\"$PASSWORD\"}"; echo
echo "cookies in the jar:"; awk 'NF >= 7 && ($1 ~ /^#HttpOnly_/ || $1 !~ /^#/) { print "  " $6 " (path " $3 ")" }' "$ALICE_JAR"

step "3. Who am I?"
get "$ALICE_JAR" "$IDENTITY_URL/api/identity/auth/me"; echo
BOB_ID="$(get "$BOB_JAR" "$IDENTITY_URL/api/identity/auth/me" | field id)"
echo "bob id: $BOB_ID"

step "4. Unsafe request without the CSRF header is blocked"
curl -sS -o /dev/null -w "HTTP %{http_code}\n" -X PATCH "$IDENTITY_URL/api/identity/users/me" -b "$ALICE_JAR" \
  -H "Content-Type: application/json" -d '{"displayName":"Alice"}'

step "5. Alice asks for a deposit of 100 USDT (Idempotency-Key makes the request safe to repeat)"
KEY="deposit-$RUN_ID"
DEPOSIT="$(post "$ALICE_JAR" "$WALLET_URL/api/wallet/deposits" '{"asset":"USDT","amount":"100"}' -H "Idempotency-Key: $KEY")"
echo "$DEPOSIT"
DEPOSIT_ID="$(echo "$DEPOSIT" | field id)"
echo "same key again (replay, same id):"
post "$ALICE_JAR" "$WALLET_URL/api/wallet/deposits" '{"asset":"USDT","amount":"100"}' -H "Idempotency-Key: $KEY" | field id

step "6. Simulate the crypto provider webhook (dev only)"
post "$ALICE_JAR" "$WALLET_URL/api/wallet/dev/simulate-deposit" "{\"depositId\":\"$DEPOSIT_ID\"}"; echo

step "7. Alice's wallet and ledger"
get "$ALICE_JAR" "$WALLET_URL/api/wallet/wallets/me"; echo
get "$ALICE_JAR" "$WALLET_URL/api/wallet/wallets/me/ledger"; echo

step "8. Alice sends 25.5 to Bob. Sending the same request twice moves money once"
TRANSFER_KEY="transfer-$RUN_ID"
post "$ALICE_JAR" "$WALLET_URL/api/wallet/transfers" "{\"recipientUserId\":\"$BOB_ID\",\"amount\":\"25.5\",\"note\":\"smoke test\"}" -H "Idempotency-Key: $TRANSFER_KEY"; echo
post "$ALICE_JAR" "$WALLET_URL/api/wallet/transfers" "{\"recipientUserId\":\"$BOB_ID\",\"amount\":\"25.5\",\"note\":\"smoke test\"}" -H "Idempotency-Key: $TRANSFER_KEY" -D - -o /dev/null | grep -i -E "^HTTP|idempotent-replayed" || true
echo "balances:"
echo -n "  alice: "; get "$ALICE_JAR" "$WALLET_URL/api/wallet/wallets/me" | field balance
echo -n "  bob:   "; get "$BOB_JAR" "$WALLET_URL/api/wallet/wallets/me" | field balance

step "9. Transfer volume report"
get "$ALICE_JAR" "$WALLET_URL/api/wallet/reports/volume"; echo

step "10. Refresh the session (the refresh token is rotated)"
curl -sS -X POST "$IDENTITY_URL/api/identity/auth/refresh" -b "$ALICE_JAR" -c "$ALICE_JAR" -H "X-CSRF-Token: $(csrf "$ALICE_JAR")"; echo

step "11. Market: list assets (needs the seed: npm run seed, or POST /assets as admin)"
ASSETS="$(get "$ALICE_JAR" "$MARKET_URL/api/market/assets?pageSize=5&sort=symbol")"
echo "$ASSETS"
SYMBOL="$(echo "$ASSETS" | field items.0.symbol)"

if [ -n "$SYMBOL" ]; then
  step "12. Open and close a position on $SYMBOL"
  POSITION="$(post "$ALICE_JAR" "$MARKET_URL/api/market/positions" "{\"symbol\":\"$SYMBOL\",\"side\":\"long\",\"quantity\":\"1.5\"}")"
  echo "$POSITION"
  POSITION_ID="$(echo "$POSITION" | field id)"
  sleep 2
  post "$ALICE_JAR" "$MARKET_URL/api/market/positions/$POSITION_ID/close" '{}'; echo
  echo "pnl summary:"
  get "$ALICE_JAR" "$MARKET_URL/api/market/positions/summary"; echo
  echo "candles:"
  get "$ALICE_JAR" "$MARKET_URL/api/market/assets/$SYMBOL/candles?interval=1m&limit=3"; echo
else
  echo "No assets yet, skipping positions. Run the seed first."
fi

step "13. Log out"
curl -sS -o /dev/null -w "HTTP %{http_code}\n" -X POST "$IDENTITY_URL/api/identity/auth/logout" -b "$ALICE_JAR" -c "$ALICE_JAR" -H "X-CSRF-Token: $(csrf "$ALICE_JAR")"

printf '\nDone.\n'
