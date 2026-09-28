import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const poolConfig = process.env.DATABASE_URL 
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false } // Required for Render/Neon remote DBs
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'ordr_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    };

const pool = new pg.Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// An idle client error (e.g. hosted Postgres dropping an idle connection)
// must not crash the whole backend. The pool replaces bad connections
// automatically on the next query.
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;
