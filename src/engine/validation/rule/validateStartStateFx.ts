import { Effect, Either } from "effect";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import { planStartFx } from "~/engine/start/fx/planStartFx";
import type { StartInvalidDiagnosticSchema } from "~/engine/validation/schema/diagnostic/StartInvalidDiagnosticSchema";

export namespace validateStartStateFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/**
 * Proves offline that the configured start can be materialized by the same
 * sequential start builder used by the runtime command.
 *
 * Runtime still validates the live candidate before commit. This rule owns only
 * the immutable authoring fact that a fresh game can boot at all.
 */
export const validateStartStateFx = Effect.fn("validateStartStateFx")(function* ({
	config,
	provenance,
}: validateStartStateFx.Props) {
	const result = yield* Effect.either(
		planStartFx({
			runtime: {
				cheats: {
					enabled: false,
					instantGameplay: false,
				},
				currentSpace: config.start.currentSpace,
				session: {
					speedMode: "normal" as const,
				},
				items: [],
				jobs: [],
				jobQueue: [],
			},
			start: config.start,
		}).pipe(Effect.provideService(GameConfigFx, config)),
	);

	if (Either.isRight(result)) {
		return [];
	}

	const error = result.left as {
		readonly _tag?: string;
	};
	const failureTag = error._tag ?? "start:unknown";
	return [
		{
			code: "start:invalid",
			severity: "error",
			path: [
				"start",
			],
			source: provenance.start,
			message: `The configured start state cannot boot: ${failureTag}.`,
			failureTag,
		},
	] satisfies StartInvalidDiagnosticSchema.Type[];
});
