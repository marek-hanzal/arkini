import { Data } from "effect";

import type { GameDiagnosticsSchema } from "../schema/GameDiagnosticsSchema";

/** One completed-game compile or validation pass produced blocking diagnostics. */
export class GameValidationError extends Data.TaggedError("GameValidationError")<{
	diagnostics: GameDiagnosticsSchema.Type;
}> {}
