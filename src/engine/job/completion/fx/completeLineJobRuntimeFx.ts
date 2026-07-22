import { Effect } from "effect";

import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { readOutputPlacementItemEventsFx } from "~/engine/event/read/readOutputPlacementItemEventsFx";
import { releaseOwnerInputsFx } from "~/engine/input/fx/releaseOwnerInputsFx";
import type { JobCompletionContext } from "~/engine/job/completion/JobCompletionContext";
import { makeChargeDepletionRandomFx } from "~/engine/job/random/makeChargeDepletionRandomFx";
import { outputFx } from "~/engine/output/fx/outputFx";
import type { OutputResultSchema } from "~/engine/output/schema/OutputResultSchema";
import { applyOutputPlacementFx } from "~/engine/placement/fx/applyOutputPlacementFx";
import { removeRuntimeItemIdentityFx } from "~/engine/runtime/fx/removeRuntimeItemIdentityFx";
import { releaseJobReservationsFx } from "./releaseJobReservationsFx";

const emptyOutput = {
	drop: [],
} satisfies OutputResultSchema.Type;

export namespace completeLineJobRuntimeFx {
	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: JobCompletionContext["runtime"];
	}
}

/** Completes one line job and returns exact semantic facts in commit order. */
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
		const random = yield* makeChargeDepletionRandomFx({
			itemId: context.owner.id,
			job: context.job,
		});
		const depletionOutput = yield* outputFx({
			origin: context.owner.location,
			output: context.owner.item.charges.output,
		}).pipe(Effect.withRandom(random));
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
