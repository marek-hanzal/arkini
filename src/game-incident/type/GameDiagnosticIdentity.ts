export interface GameDiagnosticIdentity {
	readonly sessionId: string;
	readonly applicationVersion: string;
	readonly packageId: string;
	readonly contentHash: string;
	readonly gameVersion: string;
	readonly serakkiVersion: string;
	readonly restored: boolean;
	readonly startedAt: string;
}
