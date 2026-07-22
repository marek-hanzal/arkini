import { Effect } from "effect";

import type { GameCompilationResultSchema } from "~/engine/compiler/schema/GameCompilationResultSchema";
import { GameValidationError } from "../error/GameValidationError";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

/** Converts blocking diagnostics into one typed failure for compile and pack commands. */
export const assertGameConfigValidFx = Effect.fn("assertGameConfigValidFx")(function* (
	result: GameCompilationResultSchema.Type,
) {
	const errors = result.diagnostics.filter(({ severity }) => severity === DiagnosticSeverityEnumSchema.enum.Error);
	if (errors.length > 0 || result.config === undefined) {
		return yield* Effect.fail(
			new GameValidationError({
				diagnostics: errors.length > 0 ? errors : result.diagnostics,
			}),
		);
	}

	return result.config;
});
