export declare const DASHBOARD_COOKIE_NAME = "lg_session";
export declare function createDashboardSession(userId: string): Promise<{
    id: string;
    expiresAt: Date;
}>;
export declare function resolveDashboardSession(sessionId: string | undefined): Promise<string | null>;
export declare function destroyDashboardSession(sessionId: string | undefined): Promise<void>;
