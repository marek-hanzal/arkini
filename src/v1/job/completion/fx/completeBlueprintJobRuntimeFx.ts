import { Effect } from "effect";

import type { JobCompletionContext } from "~/v1/job/completion/JobCompletionContext";
import { releaseJobReservationsFx } from "~/v1/job/completion/fx/releaseJobReservationsFx";
import { outputFx } from "~/v1/output/fx/outputFx";
import { applyOutputPlacementFx } from "~/v1/placement/fx/applyOutputPlacementFx";
import { removeRuntimeItemFx } from "~/v1/runtime/fx/removeRuntimeItemFx";

/**
 * Completes one construction blueprint through exact target replacement, optional
 * by-products, owner-state removal, and reservation return in that order.
 */
export const completeBlueprintJobRuntimeFx = Effect.fn("completeBlueprintJobRuntimeFx")(function* (
	context: JobCompletionContext<"blueprint">,
) {
	const [, withTarget] = yield* applyOutputPlacementFx({
		origin: context.owner.location.position,
		originItemId: context.owner.id,
		output: {
			drop: [
				{
					itemId: context.owner.item.targetId,
					placement: "replace",
					quantity: 1,
				},
			],
		},
		runtime: context.runtime,
	});

	const resolvedOutput =
		context.owner.item.output === undefined
			? undefined
			: yield* outputFx({
					origin: context.owner.location.position,
					output: context.owner.item.output,
				});
	const withOutput =
		resolvedOutput === undefined || resolvedOutput.drop.length === 0
			? withTarget
			: (yield* applyOutputPlacementFx({
					origin: context.owner.location.position,
					originItemId: context.owner.id,
					output: resolvedOutput,
					runtime: withTarget,
				}))[1];
	const withoutOwnerState = yield* removeRuntimeItemFx({
		item: context.owner,
		runtime: withOutput,
	});

	return yield* releaseJobReservationsFx({
		origin: context.owner.location.position,
		originItemId: context.owner.id,
		reservations: context.reservations,
		runtime: withoutOwnerState,
	});
});
