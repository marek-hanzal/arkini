import { Effect } from "effect";

import type { JobCompletionContext } from "~/v1/job/completion/JobCompletionContext";
import { releaseJobReservationsFx } from "~/v1/job/completion/fx/releaseJobReservationsFx";
import { outputFx } from "~/v1/output/fx/outputFx";
import type { OutputResultSchema } from "~/v1/output/schema/OutputResultSchema";
import { applyOutputPlacementFx } from "~/v1/placement/fx/applyOutputPlacementFx";
import { applyPlacementPlanFx } from "~/v1/placement/fx/applyPlacementPlanFx";

/**
 * Completes one already isolated single-use craft owner from its board origin.
 *
 * A resolved replace drop claims the craft cell first. Without replacement, the
 * owner is removed before ordinary output so the original cell becomes available.
 * Reservations return after all completion output.
 */
export const completeCraftJobRuntimeFx = Effect.fn("completeCraftJobRuntimeFx")(function* (
	context: JobCompletionContext<"craft">,
) {
	if (context.owner.quantity !== 1) {
		return yield* Effect.dieMessage(
			`Craft job ${context.job.id} owner ${context.owner.id} must represent exactly one quantity.`,
		);
	}

	const resolvedOutput =
		context.line.output === undefined
			? ({
					drop: [],
				} satisfies OutputResultSchema.Type)
			: yield* outputFx({
					origin: context.owner.location.position,
					output: context.line.output,
				});
	const replaceDrops = resolvedOutput.drop.filter((drop) => drop.placement === "replace");
	const ordinaryDrops = resolvedOutput.drop.filter((drop) => drop.placement !== "replace");
	let draft = context.runtime;

	if (replaceDrops.length > 0) {
		const [, withReplacement] = yield* applyOutputPlacementFx({
			origin: context.owner.location.position,
			originItemId: context.owner.id,
			output: {
				drop: replaceDrops,
			},
			runtime: draft,
		});
		draft = withReplacement;
	} else {
		const [, withoutOwner] = yield* applyPlacementPlanFx({
			plan: {
				remove: [
					context.owner.id,
				],
				spawn: [],
				stack: [],
			},
			runtime: draft,
		});
		draft = withoutOwner;
	}

	if (ordinaryDrops.length > 0) {
		const [, withOutput] = yield* applyOutputPlacementFx({
			origin: context.owner.location.position,
			originItemId: context.owner.id,
			output: {
				drop: ordinaryDrops,
			},
			runtime: draft,
		});
		draft = withOutput;
	}

	return yield* releaseJobReservationsFx({
		origin: context.owner.location.position,
		originItemId: context.owner.id,
		reservations: context.reservations,
		runtime: draft,
	});
});
