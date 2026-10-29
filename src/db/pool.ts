import { Pool } from 'pg';

// DATABASE_URL is auto-injected by Railway's Postgres add-on in production;
// locally it falls back to the "ledgerguard_dev" database created for
// development (see README's local setup section).
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/ledgerguard_dev';

export const pool = new Pool({ connectionString });
