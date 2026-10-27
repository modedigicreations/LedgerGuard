import { createHash } from 'crypto';
import { AuditTrailEntry } from '../types/index.js';

class AuditTrailManager {
  private entries: AuditTrailEntry[] = [];

  constructor() {
    // Initialize Genesis block for GAAP compliance audit chain
    this.record(
      'SYSTEM',
      'RECONCILIATION_RUN',
      'LedgerGuard Genesis: Autonomous Reconciliation & Audit Engine Initialized',
      { version: '1.0.0', engine: 'LedgerGuard Core', gaapStandard: 'ASC-606' }
    );
  }

  public record(
    actor: AuditTrailEntry['actor'],
    action: AuditTrailEntry['action'],
    details: string,
    evidence: Record<string, unknown>
  ): AuditTrailEntry {
    const sequence = this.entries.length + 1;
    const timestamp = new Date().toISOString();
    const previousHash = this.entries.length > 0 
      ? this.entries[this.entries.length - 1].currentHash 
      : '0000000000000000000000000000000000000000000000000000000000000000';

    const rawData = `${sequence}|${timestamp}|${actor}|${action}|${details}|${JSON.stringify(evidence)}|${previousHash}`;
    const currentHash = createHash('sha256').update(rawData).digest('hex');

    const entry: AuditTrailEntry = {
      sequence,
      timestamp,
      action,
      actor,
      details,
      evidence,
      previousHash,
      currentHash
    };

    this.entries.push(entry);
    return entry;
  }

  public getTrail(): AuditTrailEntry[] {
    return [...this.entries];
  }

  public verifyIntegrity(): { isValid: boolean; checkedEntries: number; error?: string } {
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const prevHash = i === 0 
        ? '0000000000000000000000000000000000000000000000000000000000000000' 
        : this.entries[i - 1].currentHash;

      if (entry.previousHash !== prevHash) {
        return {
          isValid: false,
          checkedEntries: i,
          error: `Hash chain broken at sequence ${entry.sequence}: Previous hash mismatch.`
        };
      }

      const rawData = `${entry.sequence}|${entry.timestamp}|${entry.actor}|${entry.action}|${entry.details}|${JSON.stringify(entry.evidence)}|${prevHash}`;
      const expectedHash = createHash('sha256').update(rawData).digest('hex');

      if (entry.currentHash !== expectedHash) {
        return {
          isValid: false,
          checkedEntries: i,
          error: `Hash mismatch at sequence ${entry.sequence}. Evidence may have been tampered.`
        };
      }
    }

    return { isValid: true, checkedEntries: this.entries.length };
  }
}

export const auditTrail = new AuditTrailManager();
