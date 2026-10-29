import { VarianceReport } from '../types/index.js';
export interface CronExecutionResult {
    executionId: string;
    runAt: string;
    periodAudited: string;
    status: 'SUCCESS' | 'ALERT_TRIGGERED' | 'FAILED';
    reportSummary: VarianceReport['summary'];
    slackAlertDispatched: boolean;
    slackPayload?: {
        channel: string;
        text: string;
        blocks: Array<Record<string, unknown>>;
    };
}
declare class BackgroundReconciliationCron {
    private executionHistory;
    private isRunning;
    runOvernightReconciliation(period?: string): Promise<CronExecutionResult>;
    getHistory(): CronExecutionResult[];
}
export declare const backgroundCron: BackgroundReconciliationCron;
export {};
