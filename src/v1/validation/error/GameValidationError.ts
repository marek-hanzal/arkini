import { Data } from "effect";

import type { GameDiagnosticSchema } from "../schema/GameDiagnosticSchema";

/** One completed-game compile or validation pass produced blocking diagnostics. */
export class GameValidationError extends Data.TaggedError("GameValidationError")<{
	diagnostics: ReadonlyArray<GameDiagnosticSchema.Type>;
}> {}
