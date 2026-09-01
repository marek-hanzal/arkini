import type { GameDiagnosticHistory } from "~/game-incident/schema/GameDiagnosticHistorySchema";
import type { GameDiagnosticFailure } from "~/game-incident/type/GameDiagnosticFailure";
import type { GameDiagnosticIdentity } from "~/game-incident/type/GameDiagnosticIdentity";

export interface GameDiagnosticSourceIssue {
	readonly file: number;
	readonly line: number;
	readonly message: string;
}

export interface GameDiagnosticSource {
	readonly fileCount: number;
	readonly parsedRecords: number;
	readonly issues: readonly GameDiagnosticSourceIssue[];
}

export interface GameDiagnosticSession {
	readonly identity: GameDiagnosticIdentity;
	readonly history: GameDiagnosticHistory;
	readonly failure: GameDiagnosticFailure | null;
	readonly source: GameDiagnosticSource;
}
