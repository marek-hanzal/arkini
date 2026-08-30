import { Effect, Result } from "effect";

import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/game-config/source/schema/GameSourceProvenanceSchema";
import { planStartFx } from "~/game-start/fx/planStartFx";
import type { StartInvalidDiagnosticSchema } from "~/game-config/diagnostic/schema/diagnostic/StartInvalidDiagnosticSchema";

import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticSeverityEnumSchema";
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
	const result = yield* Effect.result(
		planStartFx({
			runtime: {
				cheats: {
					enabled: false,
					everEnabled: false,
					instantGameplay: false,
				},
				currentSpace: config.start.currentSpace,
				items: [],
				jobs: [],
				jobQueue: [],
				defaultLineByOwnerItemId: {},
			},
			start: config.start,
		}).pipe(Effect.provideService(GameConfigFx, config)),
	);

	if (Result.isSuccess(result)) {
		return [];
	}

	const error = result.failure as {
		readonly _tag?: string;
	};
	const failureTag = error._tag ?? "start:unknown";
	return [
		{
			code: DiagnosticCodeEnumSchema.enum.StartInvalid,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: [
				"start",
			],
			source: provenance.start,
			message: `The configured start state cannot boot: ${failureTag}.`,
			failureTag,
		},
	] satisfies StartInvalidDiagnosticSchema.Type[];
});
