import { Effect } from "effect";

import type { GameCompilationResultSchema } from "~/v1/compiler/schema/GameCompilationResultSchema";
import { GameValidationError } from "../error/GameValidationError";

/** Converts blocking diagnostics into one typed failure for compile and pack commands. */
export const assertGameConfigValidFx = Effect.fn("assertGameConfigValidFx")(function* (
	result: GameCompilationResultSchema.Type,
) {
	const errors = result.diagnostics.filter(({ severity }) => severity === "error");
	if (errors.length > 0 || result.config === undefined) {
		return yield* Effect.fail(
			new GameValidationError({
				diagnostics: errors.length > 0 ? errors : result.diagnostics,
			}),
		);
	}

	return result.config;
});
