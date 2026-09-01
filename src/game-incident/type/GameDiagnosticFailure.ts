import type { DiagnosticValue } from "~electron/contract/diagnostics/DiagnosticRecord";
import type { GameDiagnosticItemReferenceSchema } from "~/game-incident/schema/GameDiagnosticReferenceSchema";

export interface GameDiagnosticFailure {
	readonly source: string;
	readonly sequence: number;
	readonly observedAt: string;
	readonly error: DiagnosticValue;
	readonly errorTruncated: boolean;
	readonly relatedItems: readonly GameDiagnosticItemReferenceSchema.Type[];
	readonly relatedItemsTruncated: boolean;
}
