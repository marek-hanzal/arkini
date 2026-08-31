import { Effect } from "effect";

import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { readOutputPlacementItemEventsFx } from "~/game-event/fx/readOutputPlacementItemEventsFx";
import { releaseOwnerInputsFx } from "~/production-input/fx/releaseOwnerInputsFx";
import type { JobCompletionContext } from "~/production-job/type/JobCompletionContext";
import { makeChargeDepletionRandomFx } from "~/production-job/fx/makeChargeDepletionRandomFx";
import { outputFx } from "~/production-output/fx/outputFx";
import { applyOutputPlacementFx } from "~/item-placement/fx/applyOutputPlacementFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import { releaseJobReservationsFx } from "./releaseJobReservationsFx";

const emptyOutput = {
	drop: [],
} satisfies outputFx.Result;

export namespace completeLineJobRuntimeFx {
	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: JobCompletionContext["runtime"];
	}
}

/**
 * Completes one line job and returns exact semantic facts in commit order.
 *
 * A depleted owner is detached before output placement so its board cell becomes
 * available while its last location remains the placement origin. Line output is
 * delivered before charge-depletion output, then owned inputs and job reservations
 * are released through canonical placement. The caller publishes the resulting
 * draft and this event order atomically.
 */
export const completeLineJobRuntimeFx = Effect.fn("completeLineJobRuntimeFx")(function* (
	context: JobCompletionContext,
) {
	const depleted =
		context.owner.item.charges !== undefined && context.owner.remainingCharges === 0;
	let draft = context.runtime;
	const events: GameEventSchema.Type[] = [];

	if (depleted) {
		draft = yield* removeRuntimeItemIdentityFx({
			item: context.owner,
			runtime: draft,
		});
		events.push({
			type: GameEventEnumSchema.enum.ItemDepleted,
			itemId: context.owner.id,
			canonicalItemId: context.owner.item.id,
			location: context.owner.location,
			previousQuantity: context.owner.quantity,
			resultingQuantity: 0,
		});
	}

	const lineOutput =
		context.line.output === undefined
			? emptyOutput
			: yield* outputFx({
					origin: context.owner.location,
					output: context.line.output,
				});
	if (lineOutput.drop.length > 0) {
		const [placement, withLineOutput] = yield* applyOutputPlacementFx({
			origin: context.owner.location,
			output: lineOutput,
			runtime: draft,
		});
		events.push(
			...(yield* readOutputPlacementItemEventsFx({
				originItemId: context.owner.id,
				placement,
			})),
		);
		draft = withLineOutput;
	}

	if (depleted && context.owner.item.charges?.output !== undefined) {
		const depletionOutput = yield* makeChargeDepletionRandomFx({
			itemId: context.owner.id,
			job: context.job,
			program: outputFx({
				origin: context.owner.location,
				output: context.owner.item.charges.output,
			}),
		});
		if (depletionOutput.drop.length > 0) {
			const [placement, withDepletionOutput] = yield* applyOutputPlacementFx({
				origin: context.owner.location,
				output: depletionOutput,
				runtime: draft,
			});
			events.push(
				...(yield* readOutputPlacementItemEventsFx({
					originItemId: context.owner.id,
					placement,
				})),
			);
			draft = withDepletionOutput;
		}
	}

	if (depleted) {
		const releasedInputs = yield* releaseOwnerInputsFx({
			owner: context.owner,
			runtime: draft,
		});
		events.push(...releasedInputs.events);
		draft = releasedInputs.runtime;
	}

	const releasedReservations = yield* releaseJobReservationsFx({
		origin: context.owner.location,
		originItemId: context.owner.id,
		reservations: context.reservations,
		runtime: draft,
	});
	events.push(...releasedReservations.events);

	return {
		events,
		runtime: releasedReservations.runtime,
	} satisfies completeLineJobRuntimeFx.Result;
});
