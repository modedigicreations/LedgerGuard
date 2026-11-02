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
export async function runMigrations(): Promise<void> {
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
		if (rows.length > 0) continue;

		const sql = readFileSync(join(migrationsDir, file), 'utf-8');
		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			await client.query(sql);
			await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
			await client.query('COMMIT');
			console.log(`[migrate] applied ${file}`);
		} catch (err) {
			await client.query('ROLLBACK');
			throw err;
		} finally {
			client.release();
		}
	}
}
