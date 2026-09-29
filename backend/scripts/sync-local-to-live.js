// Copies NEW tables and NEW rows from the local database to the live (Neon) database.
// Nothing that already exists on live is changed or deleted.
//
//   node scripts/sync-local-to-live.js           dry run: does everything, then rolls back and prints a report
//   node scripts/sync-local-to-live.js --apply   same, but saves it
//
// Source (local): LOCAL_DATABASE_URL, or DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD
// Target (live):  NEON_DATABASE_URL, or DATABASE_URL  (--target-db=<name> uses a local database instead, for checks)
//
// 1. New tables / columns: only migrations 033-039 are applied (all of them are safe to re-run).
//    Never run `npm run migrate` on live - older migrations drop user data.
// 2. New rows: every local row whose primary key / unique values are not on live yet is inserted
//    (parents before children). Rows already on live are left exactly as they are.
// 3. Sequences (e.g. invoice numbers) are moved forward so live never repeats a local number.
// Everything runs in one transaction: any error and nothing is saved.
import 'dotenv/config';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const targetDbArg = process.argv.find((a) => a.startsWith('--target-db='))?.split('=')[1];
const NEW_MIGRATIONS = [
  '033_onboarding_completed.js',
  '034_order_update_suggestions.js',
  '035_notification_cleared.js',
  '036_create_analytics_events.js',
  '037_password_changed_at.js',
  '038_create_contact_messages.js',
  '039_create_site_content.js',
];
const BATCH = 200;
const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const localConfig = process.env.LOCAL_DATABASE_URL
  ? { connectionString: process.env.LOCAL_DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      database: process.env.DB_NAME || 'ordr_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    };
const liveUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
const targetConfig = targetDbArg
  ? { ...localConfig, connectionString: undefined, database: targetDbArg }
  : { connectionString: liveUrl, ssl: { rejectUnauthorized: false } };

const describe = (cfg) => {
  if (cfg.connectionString) {
    const u = new URL(cfg.connectionString);
    return `${u.hostname}/${u.pathname.slice(1)}`;
  }
  return `${cfg.host}:${cfg.port}/${cfg.database}`;
};

// Values are read and written as plain text, so JSON, arrays, dates and numbers round-trip exactly
const RAW = { getTypeParser: () => (value) => value };
const q = (name) => `"${name.replace(/"/g, '""')}"`;

const tableInfo = async (client) => {
  const tables = (await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
  )).rows.map((r) => r.table_name);
  const cols = (await client.query(
    `SELECT table_name, column_name, is_generated, identity_generation
       FROM information_schema.columns WHERE table_schema = 'public' ORDER BY ordinal_position`
  )).rows;
  const info = {};
  for (const t of tables) info[t] = { columns: [], generated: new Set(), identityAlways: false };
  for (const c of cols) {
    if (!info[c.table_name]) continue;
    info[c.table_name].columns.push(c.column_name);
    if (c.is_generated === 'ALWAYS') info[c.table_name].generated.add(c.column_name);
    if (c.identity_generation === 'ALWAYS') info[c.table_name].identityAlways = true;
  }
  return info;
};

// Parents first (companies before users before orders ...)
const insertOrder = async (client, tables) => {
  const fks = (await client.query(
    `SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
       FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE c.contype = 'f' AND n.nspname = 'public'`
  )).rows;
  const clean = (name) => name.replace(/^public\./, '').replace(/"/g, '');
  const parents = Object.fromEntries(tables.map((t) => [t, new Set()]));
  for (const fk of fks) {
    const child = clean(fk.child);
    const parent = clean(fk.parent);
    if (parents[child] && child !== parent && parents[parent]) parents[child].add(parent);
  }
  const ordered = [];
  const seen = new Set();
  const visit = (t, stack = new Set()) => {
    if (seen.has(t) || stack.has(t)) return;
    stack.add(t);
    for (const p of parents[t]) visit(p, stack);
    seen.add(t);
    ordered.push(t);
  };
  [...tables].sort().forEach((t) => visit(t));
  return ordered;
};

const main = async () => {
  if (!targetDbArg && !liveUrl) throw new Error('Set NEON_DATABASE_URL or DATABASE_URL for the live database.');
  const source = new pg.Client(localConfig);
  const target = new pg.Client(targetConfig);
  const from = describe(localConfig);
  const to = describe(targetConfig);
  if (from === to) throw new Error('Source and target are the same database.');

  console.log(`Mode:   ${APPLY ? 'APPLY (changes will be saved)' : 'DRY RUN (nothing is saved)'}`);
  console.log(`From:   ${from}  (local)`);
  console.log(`To:     ${to}\n`);

  await source.connect();
  await target.connect();
  await source.query('SET default_transaction_read_only = on');
  const report = [];
  try {
    await target.query('BEGIN');

    // 1. New tables / columns
    console.log('Step 1: new tables and columns (migrations 033-039)');
    const beforeTables = new Set(Object.keys(await tableInfo(target)));
    for (const file of NEW_MIGRATIONS) {
      const { up } = await import(pathToFileURL(path.join(MIGRATIONS_DIR, file)).href);
      await target.query(up);
      console.log(`  ok  ${file}`);
    }

    const src = await tableInfo(source);
    const dst = await tableInfo(target);
    const created = Object.keys(dst).filter((t) => !beforeTables.has(t));
    if (created.length) console.log(`  New tables on live: ${created.join(', ')}`);

    // Local tables / columns live still does not have: reported, never guessed
    const missingTables = Object.keys(src).filter((t) => !dst[t]);
    const skipped = new Set(missingTables);
    for (const t of Object.keys(src).filter((name) => dst[name])) {
      const missingCols = src[t].columns.filter((c) => !dst[t].columns.includes(c));
      if (missingCols.length) {
        console.log(`  !! ${t}: live has no column(s) ${missingCols.join(', ')} - table skipped`);
        skipped.add(t);
      }
    }
    if (missingTables.length) console.log(`  !! Tables only on local (skipped): ${missingTables.join(', ')}`);

    // 2. New rows
    console.log('\nStep 2: new rows');
    const tables = await insertOrder(source, Object.keys(src).filter((t) => !skipped.has(t)));
    for (const table of tables) {
      const columns = src[table].columns.filter((c) => !dst[table].generated.has(c));
      if (columns.length === 0) continue;
      const colList = columns.map(q).join(', ');
      const rows = (await source.query({ text: `SELECT ${colList} FROM ${q(table)}`, types: RAW })).rows;
      const before = parseInt((await target.query(`SELECT COUNT(*) AS n FROM ${q(table)}`)).rows[0].n, 10);
      const override = dst[table].identityAlways ? ' OVERRIDING SYSTEM VALUE' : '';
      const insert = async (batch) => {
        const params = [];
        const values = batch.map((row) => `(${columns.map((c) => { params.push(row[c]); return `$${params.length}`; }).join(', ')})`);
        await target.query(`INSERT INTO ${q(table)} (${colList})${override} VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`, params);
      };

      // Fast path in batches; a batch that fails (e.g. its parent row was not copied) is retried row by row
      let pending = [];
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        await target.query('SAVEPOINT batch');
        try {
          await insert(batch);
          await target.query('RELEASE SAVEPOINT batch');
        } catch {
          await target.query('ROLLBACK TO SAVEPOINT batch');
          pending.push(...batch);
        }
      }
      // Rows pointing at rows of the same table can need more than one pass
      const errors = [];
      let progress = true;
      while (pending.length && progress) {
        progress = false;
        const failed = [];
        errors.length = 0;
        for (const row of pending) {
          await target.query('SAVEPOINT one');
          try {
            await insert([row]);
            await target.query('RELEASE SAVEPOINT one');
            progress = true;
          } catch (err) {
            await target.query('ROLLBACK TO SAVEPOINT one');
            failed.push(row);
            errors.push(err.message);
          }
        }
        pending = failed;
      }

      const after = parseInt((await target.query(`SELECT COUNT(*) AS n FROM ${q(table)}`)).rows[0].n, 10);
      const added = after - before;
      report.push({ table, local: rows.length, liveBefore: before, added, notCopied: pending.length });
      if (pending.length) {
        console.log(`  !! ${table}: ${pending.length} row(s) could not be copied, e.g. ${errors[0]}`);
      }
    }
    console.table(report.filter((r) => r.local > 0 || r.added > 0));

    // 3. Sequences (invoice numbers, serial ids) never go backwards
    const seqs = (await target.query(
      "SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'"
    )).rows.map((r) => r.sequence_name);
    for (const seq of seqs) {
      const local = await source.query(`SELECT last_value, is_called FROM ${q(seq)}`).catch(() => null);
      if (!local?.rows[0]?.is_called) continue;
      const live = (await target.query(`SELECT last_value, is_called FROM ${q(seq)}`)).rows[0];
      const localValue = BigInt(local.rows[0].last_value);
      const liveValue = live.is_called ? BigInt(live.last_value) : 0n;
      if (localValue > liveValue) {
        await target.query('SELECT setval($1, $2, true)', [seq, localValue.toString()]);
        console.log(`  Sequence ${seq}: moved to ${localValue}`);
      }
    }

    if (APPLY) {
      await target.query('COMMIT');
      console.log('\nDone. Changes are saved on the target database.');
    } else {
      await target.query('ROLLBACK');
      console.log('\nDry run finished - nothing was saved. Run again with --apply to save.');
    }
  } catch (error) {
    await target.query('ROLLBACK').catch(() => {});
    console.error('\nStopped, nothing was saved:', error.message);
    process.exitCode = 1;
  } finally {
    await source.end();
    await target.end();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
