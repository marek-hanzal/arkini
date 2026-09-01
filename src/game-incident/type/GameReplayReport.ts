import type { GameDiagnosticHistory } from "~/game-incident/schema/GameDiagnosticHistorySchema";
import type { GameDiagnosticFailure } from "~/game-incident/type/GameDiagnosticFailure";
import type { GameDiagnosticRuntime } from "~/game-incident/type/GameDiagnosticRuntime";

export interface GameReplayReport {
	readonly applicationVersion: string;
	readonly packageId: string;
	readonly contentHash: string;
	readonly gameVersion: string;
	readonly elapsedMs: number;
	readonly result: "fatal" | "timeout";
	readonly initialSequence: number;
	readonly finalSequence: number;
	readonly observedSnapshots: number;
	readonly semanticTransitions: number;
	readonly history: GameDiagnosticHistory;
	readonly failure: GameDiagnosticFailure | null;
	readonly initialRuntime: GameDiagnosticRuntime;
	readonly finalRuntime: GameDiagnosticRuntime;
}
