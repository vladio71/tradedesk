import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

/** Loads a .env file from the current working directory when there is one. Real env vars win. */
export function loadEnvFile(): void {
  const path = resolve(process.cwd(), '.env');
  if (existsSync(path)) {
    loadDotenv({ path, quiet: true });
  }
}
