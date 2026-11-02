import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, 'migrations');
// Plain numbered .sql files, tracked by filename in schema_migrations — no
// migration framework needed at this size. Each file must be idempotent
// enough to be safe to run every boot (IF NOT EXISTS / ON CONFLICT), since
// this runs on every server start, not just once.
export async function runMigrations() {
    await pool.query(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`);
    const files = readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();
    for (const file of files) {
        const { rows } = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
        if (rows.length > 0)
            continue;
        const sql = readFileSync(join(migrationsDir, file), 'utf-8');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
            await client.query('COMMIT');
            console.log(`[migrate] applied ${file}`);
        }
        catch (err) {
            await client.query('ROLLBACK');
            // TEMP diagnostic (remove once the Phase B deploy issue is
            // understood): dump the actual current shape of the two
            // tables 003_multi_tenant.sql touches first, since the error
            // this is chasing ("column user_id does not exist") doesn't
            // reproduce against a from-scratch local DB on the exact same
            // SQL — something about this specific database's existing
            // state must differ.
            try {
                const cols = await pool.query(`SELECT table_name, column_name, data_type FROM information_schema.columns
					 WHERE table_name IN ('connected_accounts', 'journal_adjustments', 'audit_trail_entries', 'users')
					 ORDER BY table_name, ordinal_position`);
                console.error('[migrate] DIAGNOSTIC current columns:', JSON.stringify(cols.rows, null, 2));
                const applied = await pool.query('SELECT filename, applied_at FROM schema_migrations ORDER BY applied_at');
                console.error('[migrate] DIAGNOSTIC schema_migrations:', JSON.stringify(applied.rows, null, 2));
            }
            catch (diagErr) {
                console.error('[migrate] DIAGNOSTIC query itself failed:', diagErr);
            }
            throw err;
        }
        finally {
            client.release();
        }
    }
}
//# sourceMappingURL=migrate.js.map