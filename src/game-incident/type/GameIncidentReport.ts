import type { GameDiagnosticRuntime } from "~/game-incident/type/GameDiagnosticRuntime";
import type { GameDiagnosticSession } from "~/game-incident/type/GameDiagnosticSession";

export interface GameIncidentReport {
	readonly capturedAt: string;
	readonly diagnostics: GameDiagnosticSession;
	readonly runtime: GameDiagnosticRuntime;
}

export interface GameIncidentTextBundle {
	readonly incident: string;
	readonly failure: string;
	readonly history: string;
	readonly runtimeState: string;
}
