/**
 * Seed data for local development: npm run seed
 * Needs the services to have started once, because they create the tables (migrations run on startup).
 * Safe to run many times.
 */
import { hash } from 'bcryptjs';
import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';

loadDotenv({ quiet: true });

const url = (name: string, fallback: string): string => process.env[name] || fallback;
const IDENTITY_URL = url('IDENTITY_DATABASE_URL', 'postgres://tradedesk:tradedesk@localhost:5432/identity');
const WALLET_URL = url('WALLET_DATABASE_URL', 'postgres://tradedesk:tradedesk@localhost:5432/wallet');
const MARKET_URL = url('MARKET_DATABASE_URL', 'postgres://tradedesk:tradedesk@localhost:5432/market');

interface SeedUser {
  id: string;
  email: string;
  password: string;
  displayName: string;
  role: 'user' | 'admin';
  balance: string;
}

// Fixed ids, so wallets in the wallet database point at the same users as in the identity database.
const USERS: SeedUser[] = [
  { id: '00000000-0000-4000-8000-000000000001', email: 'admin@tradedesk.dev', password: 'Admin12345!', displayName: 'Admin', role: 'admin', balance: '1000.00000000' },
  { id: '00000000-0000-4000-8000-000000000002', email: 'alice@tradedesk.dev', password: 'Password123!', displayName: 'Alice', role: 'user', balance: '10000.00000000' },
  { id: '00000000-0000-4000-8000-000000000003', email: 'bob@tradedesk.dev', password: 'Password123!', displayName: 'Bob', role: 'user', balance: '2500.00000000' },
];

const ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', category: 'crypto', price: '60000' },
  { symbol: 'ETH', name: 'Ethereum', category: 'crypto', price: '3000' },
  { symbol: 'SOL', name: 'Solana', category: 'crypto', price: '150' },
  { symbol: 'AAPL', name: 'Apple Inc.', category: 'stock', price: '190.5' },
  { symbol: 'TSLA', name: 'Tesla Inc.', category: 'stock', price: '250.25' },
  { symbol: 'EURUSD', name: 'Euro / US Dollar', category: 'forex', price: '1.08' },
  { symbol: 'XAUUSD', name: 'Gold', category: 'commodity', price: '2300' },
  { symbol: 'WTI', name: 'Crude Oil WTI', category: 'commodity', price: '80.4' },
];

async function withClient<T>(connectionString: string, work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

async function seedIdentity(): Promise<void> {
  await withClient(IDENTITY_URL, async (client) => {
    for (const user of USERS) {
      const passwordHash = await hash(user.password, 10);
      await client.query(
        `INSERT INTO users (id, email, password_hash, display_name, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING`,
        [user.id, user.email, passwordHash, user.displayName, user.role],
      );
    }
  });
  console.log(`identity: ${USERS.length} users`);
}

async function seedWallets(): Promise<void> {
  await withClient(WALLET_URL, async (client) => {
    for (const user of USERS) {
      await client.query('BEGIN');
      await client.query(`INSERT INTO wallets (id, user_id) VALUES (gen_random_uuid(), $1) ON CONFLICT (user_id) DO NOTHING`, [user.id]);
      const wallet = await client.query(`SELECT id FROM wallets WHERE user_id = $1`, [user.id]);
      // The reference id is fixed per user, so running the seed twice does not fund the wallet twice.
      const referenceId = `ffffffff-ffff-4fff-8fff-${user.id.slice(-12)}`;
      const entry = await client.query(
        `INSERT INTO ledger_entries (id, wallet_id, kind, direction, amount, balance_after, reference_id)
         VALUES (gen_random_uuid(), $1, 'deposit', 'credit', $2, $2, $3)
         ON CONFLICT (wallet_id, kind, reference_id) DO NOTHING
         RETURNING id`,
        [wallet.rows[0].id, user.balance, referenceId],
      );
      if (entry.rowCount) {
        await client.query(`UPDATE wallets SET balance = balance + $2, updated_at = now() WHERE id = $1`, [wallet.rows[0].id, user.balance]);
      }
      await client.query('COMMIT');
    }
  });
  console.log(`wallet: ${USERS.length} funded wallets`);
}

async function seedMarket(): Promise<void> {
  await withClient(MARKET_URL, async (client) => {
    for (const asset of ASSETS) {
      await client.query(
        `INSERT INTO assets (id, symbol, name, category, status, last_price) VALUES (gen_random_uuid(), $1, $2, $3, 'active', $4) ON CONFLICT (symbol) DO NOTHING`,
        [asset.symbol, asset.name, asset.category, asset.price],
      );
    }
  });
  console.log(`market: ${ASSETS.length} assets`);
}

async function main(): Promise<void> {
  await seedIdentity();
  await seedWallets();
  await seedMarket();
  console.log('\nLogins:');
  for (const user of USERS) {
    console.log(`  ${user.role.padEnd(5)} ${user.email}  ${user.password}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
