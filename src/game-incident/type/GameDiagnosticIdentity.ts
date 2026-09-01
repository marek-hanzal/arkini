export interface GameDiagnosticIdentity {
	readonly sessionId: string;
	readonly applicationVersion: string;
	readonly packageId: string;
	readonly contentHash: string;
	readonly gameVersion: string;
	readonly arkiniVersion: string;
	readonly restored: boolean;
	readonly startedAt: string;
}
