import { Effect } from "effect";

import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { readOutcomePlacementItemEventsFx } from "~/game-event/fx/readOutcomePlacementItemEventsFx";
import { releaseOwnerInputsFx } from "~/production-input/fx/releaseOwnerInputsFx";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import type { ReservedRuntimeItemSchema } from "~/game-runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { makeUnitDepletionRandomFx } from "~/production-job/fx/makeUnitDepletionRandomFx";
import { resolveOutcomeTableFx } from "~/outcome/fx/resolveOutcomeTableFx";
import { applyOutcomeTableFx } from "~/outcome/fx/applyOutcomeTableFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import { releaseJobReservationsFx } from "./releaseJobReservationsFx";

const emptyOutcome = {
	roll: [],
} satisfies resolveOutcomeTableFx.Result;

export namespace settleJobRuntimeFx {
	export interface Props {
		readonly job: JobSchema.Type;
		readonly owner: BoardRuntimeItemSchema.Type;
		readonly lineOutcome?: OutcomeTableSchema.Type;
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
 * A depleted owner's cell is freed before outcome and returns; abort supplies no line outcome.
 * Outcome conditions read the caller-provided input snapshot, never this partial draft.
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
		const removed = yield* removeRuntimeItemIdentityFx({
			item: context.owner,
			runtime: withoutDepletedOwnerQueue,
		});
		draft = removed.runtime;
		events.push(...removed.events);
		events.push({
			type: GameEventEnumSchema.enum.ItemDepleted,
			itemId: context.owner.id,
			itemUid: context.owner.item.uid,
			location: context.owner.location,
		});
	}

	const lineOutcome =
		context.lineOutcome === undefined
			? emptyOutcome
			: yield* resolveOutcomeTableFx({
					ownerItemId: context.owner.id,
					origin: context.owner.location,
					outcome: context.lineOutcome,
				});
	if (lineOutcome.roll.length > 0) {
		const [placement, withLineOutcome] = yield* applyOutcomeTableFx({
			outcome: lineOutcome,
			runtime: draft,
		});
		events.push(
			...(yield* readOutcomePlacementItemEventsFx({
				originItemId: context.owner.id,
				placement,
			})),
		);
		draft = withLineOutcome;
	}

	if (depleted && context.owner.item.units?.outcome !== undefined) {
		const depletionOutcome = yield* makeUnitDepletionRandomFx({
			itemId: context.owner.id,
			job: context.job,
			program: resolveOutcomeTableFx({
				ownerItemId: context.owner.id,
				origin: context.owner.location,
				outcome: context.owner.item.units.outcome,
			}),
		});
		if (depletionOutcome.roll.length > 0) {
			const [placement, withDepletionOutcome] = yield* applyOutcomeTableFx({
				outcome: depletionOutcome,
				overflow: context.overflow,
				runtime: draft,
			});
			const placementEvents = yield* readOutcomePlacementItemEventsFx({
				originItemId: context.owner.id,
				placement,
			});
			events.push(
				...placementEvents,
				...(placement.discarded ?? []).map(
					(loss): GameEventSchema.Type => ({
						type: GameEventEnumSchema.enum.ItemDiscarded,
						ownerItemId: context.owner.id,
						itemUid: loss.itemUid,
						quantity: loss.quantity,
						source: "depletion-outcome",
						reason: loss.reason,
					}),
				),
			);
			depletionReplacementPlaced = placementEvents.length > 0;
			draft = withDepletionOutcome;
		}
	}

	if (depleted && !depletionReplacementPlaced) {
		events.push({
			type: GameEventEnumSchema.enum.ItemDisappeared,
			itemId: context.owner.id,
			itemUid: context.owner.item.uid,
			location: context.owner.location,
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
