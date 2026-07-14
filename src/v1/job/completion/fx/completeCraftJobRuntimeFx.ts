import { Effect } from "effect";

import type { JobCompletionContext } from "~/v1/job/completion/JobCompletionContext";
import { consumeCraftOwnerFx } from "~/v1/job/completion/fx/consumeCraftOwnerFx";
import { placeCraftOwnerRemainderFx } from "~/v1/job/completion/fx/placeCraftOwnerRemainderFx";
import { releaseJobReservationsFx } from "~/v1/job/completion/fx/releaseJobReservationsFx";
import { outputFx } from "~/v1/output/fx/outputFx";
import type { OutputResultSchema } from "~/v1/output/schema/OutputResultSchema";
import { applyOutputPlacementFx } from "~/v1/placement/fx/applyOutputPlacementFx";

/**
 * Completes one single-use craft unit from its original board origin.
 *
 * A resolved replace drop claims the craft cell first. Any unprocessed owner-stack
 * remainder then returns through standard placement before additional output. Without a
 * replacement, one owner quantity is consumed in place and the cell becomes available
 * only when no stack remainder survives. Reservations return after completion output.
 */
export const completeCraftJobRuntimeFx = Effect.fn("completeCraftJobRuntimeFx")(function* (
	context: JobCompletionContext<"craft">,
) {
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
	const consumed = yield* consumeCraftOwnerFx({
		context,
		replaced: replaceDrops.length > 0,
	});
	let draft = consumed.runtime;

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
	}

	draft = yield* placeCraftOwnerRemainderFx({
		context,
		quantity: consumed.remainderQuantity,
		runtime: draft,
	});

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
