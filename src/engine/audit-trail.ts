import { createHash } from 'crypto';
import { AuditTrailEntry } from '../types/index.js';
import { pool } from '../db/pool.js';

const GENESIS_PREVIOUS_HASH = '0000000000000000000000000000000000000000000000000000000000000000'.slice(0, 64);

function computeHash(
	sequence: number,
	timestamp: string,
	actor: string,
	action: string,
	details: string,
	evidence: Record<string, unknown>,
	previousHash: string,
): string {
	const rawData = `${sequence}|${timestamp}|${actor}|${action}|${details}|${JSON.stringify(evidence)}|${previousHash}`;
	return createHash('sha256').update(rawData).digest('hex');
}

function rowToEntry(row: {
	sequence: string | number;
	timestamp: Date;
	action: string;
	actor: string;
	details: string;
	evidence: Record<string, unknown>;
	previous_hash: string;
	current_hash: string;
}): AuditTrailEntry {
	return {
		sequence: Number(row.sequence),
		timestamp: row.timestamp.toISOString(),
		action: row.action as AuditTrailEntry['action'],
		actor: row.actor as AuditTrailEntry['actor'],
		details: row.details,
		evidence: row.evidence,
		previousHash: row.previous_hash,
		currentHash: row.current_hash,
	};
}

class AuditTrailManager {
	// Memoized per-process so concurrent requests on a fresh deploy don't
	// race to insert the genesis entry twice. With numReplicas: 1 (today's
	// deploy) that's sufficient; scaling to multiple replicas would need a
	// real advisory lock here instead.
	private genesisReady: Promise<void> | null = null;

	private ensureGenesis(): Promise<void> {
		if (!this.genesisReady) {
			this.genesisReady = (async () => {
				const { rows } = await pool.query('SELECT 1 FROM audit_trail_entries LIMIT 1');
				if (rows.length === 0) {
					await this.appendEntry(
						'SYSTEM',
						'RECONCILIATION_RUN',
						'LedgerGuard Genesis: Autonomous Reconciliation & Audit Engine Initialized',
						{ version: '1.0.0', engine: 'LedgerGuard Core', gaapStandard: 'ASC-606' },
					);
				}
			})();
		}
		return this.genesisReady;
	}

	private async appendEntry(
		actor: AuditTrailEntry['actor'],
		action: AuditTrailEntry['action'],
		details: string,
		evidence: Record<string, unknown>,
	): Promise<AuditTrailEntry> {
		// Serialized via a row lock, not a SERIAL column: sequence and
		// previousHash both depend on "the last row so far," so two
		// concurrent appends must not interleave between reading that and
		// writing their own row — that would silently break the hash chain.
		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			await client.query('SELECT id FROM audit_trail_lock FOR UPDATE');

			const { rows: lastRows } = await client.query(
				'SELECT sequence, current_hash FROM audit_trail_entries ORDER BY sequence DESC LIMIT 1',
			);
			const sequence = lastRows.length > 0 ? Number(lastRows[0].sequence) + 1 : 1;
			const previousHash = lastRows.length > 0 ? lastRows[0].current_hash : GENESIS_PREVIOUS_HASH;
			const timestamp = new Date().toISOString();
			const currentHash = computeHash(sequence, timestamp, actor, action, details, evidence, previousHash);

			await client.query(
				`INSERT INTO audit_trail_entries (sequence, timestamp, action, actor, details, evidence, previous_hash, current_hash)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				[sequence, timestamp, action, actor, details, JSON.stringify(evidence), previousHash, currentHash],
			);
			await client.query('COMMIT');

			return { sequence, timestamp, action, actor, details, evidence, previousHash, currentHash };
		} catch (err) {
			await client.query('ROLLBACK');
			throw err;
		} finally {
			client.release();
		}
	}

	public async record(
		actor: AuditTrailEntry['actor'],
		action: AuditTrailEntry['action'],
		details: string,
		evidence: Record<string, unknown>,
	): Promise<AuditTrailEntry> {
		await this.ensureGenesis();
		return this.appendEntry(actor, action, details, evidence);
	}

	public async getTrail(): Promise<AuditTrailEntry[]> {
		await this.ensureGenesis();
		const { rows } = await pool.query('SELECT * FROM audit_trail_entries ORDER BY sequence ASC');
		return rows.map(rowToEntry);
	}

	public async verifyIntegrity(): Promise<{ isValid: boolean; checkedEntries: number; error?: string }> {
		const entries = await this.getTrail();

		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			const prevHash = i === 0 ? GENESIS_PREVIOUS_HASH : entries[i - 1].currentHash;

			if (entry.previousHash !== prevHash) {
				return {
					isValid: false,
					checkedEntries: i,
					error: `Hash chain broken at sequence ${entry.sequence}: Previous hash mismatch.`,
				};
			}

			const expectedHash = computeHash(
				entry.sequence,
				entry.timestamp,
				entry.actor,
				entry.action,
				entry.details,
				entry.evidence,
				prevHash,
			);

			if (entry.currentHash !== expectedHash) {
				return {
					isValid: false,
					checkedEntries: i,
					error: `Hash mismatch at sequence ${entry.sequence}. Evidence may have been tampered.`,
				};
			}
		}

		return { isValid: true, checkedEntries: entries.length };
	}
}

export const auditTrail = new AuditTrailManager();
