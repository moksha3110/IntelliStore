import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from '@intellistore/shared-logger';
import { config } from '../config';
import { pool } from './pool';

const logger = createLogger({ serviceName: `${config.serviceName}:migrate` });
const migrationsDir = join(__dirname, '..', '..', 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function appliedMigrationNames(): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
  return new Set(result.rows.map((row) => row.name));
}

async function run(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await appliedMigrationNames();

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      logger.info(`skipping already-applied migration: ${file}`);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      logger.info(`applied migration: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ err }, `failed to apply migration: ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }
}

run()
  .then(() => pool.end())
  .catch((err) => {
    logger.error({ err }, 'migration run failed');
    return pool.end().finally(() => process.exit(1));
  });
