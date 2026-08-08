import { GameValidationError } from "~/engine/validation/error/GameValidationError";
import type { GameDiagnosticSchema } from "~/engine/validation/schema/GameDiagnosticSchema";

export type EditorGameDiagnostic = GameDiagnosticSchema.Type;

/** Projects structured Build diagnostics without leaking engine errors into reusable UI. */
export const readEditorBuildDiagnostics = (error: unknown) =>
	error instanceof GameValidationError ? error.diagnostics : undefined;
