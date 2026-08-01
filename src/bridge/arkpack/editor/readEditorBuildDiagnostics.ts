import { GameValidationError } from "~/engine/validation/error/GameValidationError";

/** Projects structured Build diagnostics without leaking engine errors into reusable UI. */
export const readEditorBuildDiagnostics = (error: unknown) =>
	error instanceof GameValidationError ? error.diagnostics : undefined;
