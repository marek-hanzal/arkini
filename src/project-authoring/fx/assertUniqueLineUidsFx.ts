import { Effect } from "effect";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { validateItemLineUidsFn } from "~/game-config-validation/fn/validateItemLineUidsFn";
import {
	ProjectRepositoryError,
	type ProjectRepositoryOperation,
} from "~/project-authoring/error/ProjectRepositoryError";

/** Identity collisions cannot enter a live Editor project, even while other gameplay facts are unfinished. */
export const assertUniqueLineUidsFx = Effect.fn("assertUniqueLineUidsFx")(function* (
	config: GameConfigSchema.Type,
	operation: ProjectRepositoryOperation,
) {
	const diagnostics = validateItemLineUidsFn({
		config,
		provenance: {
			items: {},
		},
	}).filter(({ code }) => code === DiagnosticCodeEnumSchema.enum.LineDuplicateUid);
	if (diagnostics.length > 0)
		return yield* Effect.fail(
			new ProjectRepositoryError({
				operation,
				message: diagnostics.map(({ message }) => message).join("\n"),
				diagnostics,
			}),
		);
});
