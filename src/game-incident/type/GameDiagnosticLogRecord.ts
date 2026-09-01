import type { DiagnosticValue } from "~electron/contract/diagnostics/DiagnosticRecord";
import type { GameDiagnosticSourceIssue } from "~/game-incident/type/GameDiagnosticSession";

export interface GameDiagnosticLogRecord {
	readonly file: number;
	readonly line: number;
	readonly timestamp: string;
	readonly event: string;
	readonly sessionId: string | null;
	readonly data: Readonly<Record<string, DiagnosticValue>>;
}

export type GameDiagnosticLogLineResult =
	| {
			readonly ok: true;
			readonly record: GameDiagnosticLogRecord;
	  }
	| {
			readonly ok: false;
			readonly issue: GameDiagnosticSourceIssue;
	  };
