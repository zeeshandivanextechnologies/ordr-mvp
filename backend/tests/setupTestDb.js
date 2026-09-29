// npm run test:db            (add -- --reset to drop and rebuild the test database)
// Creates the local test database (e.g. ordr_db_test) if needed and applies every
// migration from 001 onwards. Safe to run again: applied migrations are remembered
// in test_schema_migrations (test database only; the app's own runner is untouched).
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import pg from 'pg';
import { TEST_DB } from './setup.js';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const connection = (database) =>
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database,
      };

const main = async () => {
  if (!process.env.DATABASE_URL) {
    const admin = new pg.Client(connection('postgres'));
    await admin.connect();
    const safeName = TEST_DB.dbName.replace(/"/g, '');
    if (process.argv.includes('--reset')) {
      await admin.query(`DROP DATABASE IF EXISTS "${safeName}" WITH (FORCE)`);
      console.log(`Dropped database ${TEST_DB.dbName}`);
    }
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB.dbName]);
    if (exists.rows.length === 0) {
      await admin.query(`CREATE DATABASE "${safeName}"`);
      console.log(`Created database ${TEST_DB.dbName}`);
    }
    await admin.end();
  }

  const client = new pg.Client(connection(TEST_DB.dbName));
  await client.connect();
  await client.query('CREATE TABLE IF NOT EXISTS test_schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())');
  const done = new Set((await client.query('SELECT name FROM test_schema_migrations')).rows.map((r) => r.name));
  const hasSchema = (await client.query("SELECT to_regclass('public.companies') AS t")).rows[0].t;
  if (hasSchema && done.size === 0) {
    throw new Error('The test database has tables but no migration history. Rebuild it with: npm run test:db -- --reset');
  }
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{3}_.*\.js$/.test(f)).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const { up } = await import(pathToFileURL(path.join(MIGRATIONS_DIR, file)).href);
    await client.query(up);
    applied += 1;
    await client.query('INSERT INTO test_schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
  }
  await client.end();
  console.log(`Test database ${TEST_DB.dbName} is ready (${applied} new migration(s) applied, ${files.length} in total).`);
};

main().catch((error) => {
  console.error('Test database setup failed:', error.message);
  process.exit(1);
});
