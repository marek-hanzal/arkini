import { Effect } from "effect";

import type { GameCompilationResultSchema } from "~/game-config-compiler/schema/GameCompilationResultSchema";
import { GameValidationError } from "~/game-config-diagnostic/error/GameValidationError";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

/** Converts blocking diagnostics into one typed failure for compile and pack commands. */
export const assertGameConfigValidFx = Effect.fn("assertGameConfigValidFx")(function* (
	result: GameCompilationResultSchema.Type,
) {
	const errors = result.diagnostics.filter(
		({ severity }) => severity === DiagnosticSeverityEnumSchema.enum.Error,
	);
	if (errors.length > 0 || result.config === undefined) {
		return yield* Effect.fail(
			new GameValidationError({
				diagnostics: errors.length > 0 ? errors : result.diagnostics,
			}),
		);
	}

	return result.config;
});
