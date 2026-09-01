import type { DiagnosticValue } from "~electron/contract/diagnostics/DiagnosticRecord";
import type {
	GameDiagnosticItemReferenceSchema,
	GameDiagnosticJobReferenceSchema,
	GameDiagnosticQueueReferenceSchema,
} from "~/game-incident/schema/GameDiagnosticReferenceSchema";

export interface GameDiagnosticRuntimeItem {
	readonly item: GameDiagnosticItemReferenceSchema.Type;
	readonly revision: string;
	readonly quantity: number;
	readonly remainingCharges?: number;
	readonly remainingDurationMs?: number;
	readonly location: DiagnosticValue;
}

export interface GameDiagnosticRuntimeJob extends GameDiagnosticJobReferenceSchema.Type {
	readonly durationMs: number;
	readonly remainingMs: number;
}

export interface GameDiagnosticRuntimeDefaultLine {
	readonly owner: GameDiagnosticItemReferenceSchema.Type;
	readonly lineId: string | null;
}

export interface GameDiagnosticRuntime {
	readonly currentSpace: number;
	readonly cheats: {
		readonly enabled: boolean;
		readonly everEnabled: boolean;
		readonly instantGameplay: boolean;
	};
	readonly items: readonly GameDiagnosticRuntimeItem[];
	readonly jobs: readonly GameDiagnosticRuntimeJob[];
	readonly queue: readonly GameDiagnosticQueueReferenceSchema.Type[];
	readonly defaultLines: readonly GameDiagnosticRuntimeDefaultLine[];
}
