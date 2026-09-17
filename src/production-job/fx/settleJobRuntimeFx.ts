import { Effect } from "effect";

import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { readOutputPlacementItemEventsFx } from "~/game-event/fx/readOutputPlacementItemEventsFx";
import { releaseOwnerInputsFx } from "~/production-input/fx/releaseOwnerInputsFx";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";
import type { ReservedRuntimeItemSchema } from "~/game-runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import { makeUnitDepletionRandomFx } from "~/production-job/fx/makeUnitDepletionRandomFx";
import { outputFx } from "~/production-output/fx/outputFx";
import { applyOutputPlacementFx } from "~/item-placement/fx/applyOutputPlacementFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import { releaseJobReservationsFx } from "./releaseJobReservationsFx";

const emptyOutput = {
	drop: [],
} satisfies outputFx.Result;

export namespace settleJobRuntimeFx {
	export interface Props {
		readonly job: JobSchema.Type;
		readonly owner: GridRuntimeItemSchema.Type;
		readonly lineOutput?: OutputSchema.Type;
		readonly reservations: readonly ReservedRuntimeItemSchema.Type[];
		readonly overflow?: "discard";
		readonly runtime: RuntimeSchema.Type;
	}
	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Settles completion or material abort after the job and consumed roots are detached.
 * A depleted owner's cell is freed before output and returns; abort supplies no line output.
 * Output conditions read the caller-provided input snapshot, never this partial draft.
 */
export const settleJobRuntimeFx = Effect.fn("settleJobRuntimeFx")(function* (
	context: settleJobRuntimeFx.Props,
) {
	const depleted = context.owner.item.units !== undefined && context.owner.remainingUnits === 0;
	let draft = context.runtime;
	const events: GameEventSchema.Type[] = [];
	let depletionReplacementPlaced = false;

	if (depleted) {
		const withoutDepletedOwnerQueue = {
			...draft,
			jobQueue: draft.jobQueue.filter((request) => request.ownerItemId !== context.owner.id),
		};
		draft = yield* removeRuntimeItemIdentityFx({
			item: context.owner,
			runtime: withoutDepletedOwnerQueue,
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
		context.lineOutput === undefined
			? emptyOutput
			: yield* outputFx({
					origin: context.owner.location,
					output: context.lineOutput,
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

	if (depleted && context.owner.item.units?.output !== undefined) {
		const depletionOutput = yield* makeUnitDepletionRandomFx({
			itemId: context.owner.id,
			job: context.job,
			program: outputFx({
				origin: context.owner.location,
				output: context.owner.item.units.output,
			}),
		});
		if (depletionOutput.drop.length > 0) {
			const [placement, withDepletionOutput] = yield* applyOutputPlacementFx({
				origin: context.owner.location,
				output: depletionOutput,
				overflow: context.overflow,
				runtime: draft,
			});
			const placementEvents = yield* readOutputPlacementItemEventsFx({
				originItemId: context.owner.id,
				placement,
			});
			events.push(
				...placementEvents,
				...(placement.discarded ?? []).map(
					(loss): GameEventSchema.Type => ({
						type: GameEventEnumSchema.enum.ItemDiscarded,
						ownerItemId: context.owner.id,
						canonicalItemId: loss.itemId,
						quantity: loss.quantity,
						source: "depletion-output",
						reason: loss.reason,
					}),
				),
			);
			depletionReplacementPlaced = placementEvents.length > 0;
			draft = withDepletionOutput;
		}
	}

	if (depleted && !depletionReplacementPlaced) {
		events.push({
			type: GameEventEnumSchema.enum.ItemDisappeared,
			itemId: context.owner.id,
			canonicalItemId: context.owner.item.id,
			location: context.owner.location,
			quantity: context.owner.quantity,
		});
	}

	if (depleted) {
		const releasedInputs = yield* releaseOwnerInputsFx({
			owner: context.owner,
			origin: context.owner.location,
			overflow: context.overflow,
			runtime: draft,
		});
		events.push(...releasedInputs.events);
		draft = releasedInputs.runtime;
	}

	const releasedReservations = yield* releaseJobReservationsFx({
		origin: context.owner.location,
		originItemId: context.owner.id,
		reservations: context.reservations,
		overflow: context.overflow,
		runtime: draft,
	});
	events.push(...releasedReservations.events);

	return {
		events,
		runtime: releasedReservations.runtime,
	} satisfies settleJobRuntimeFx.Result;
});
