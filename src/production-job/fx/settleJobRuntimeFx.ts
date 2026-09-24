import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { Effect } from "effect";

import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { EngineFact } from "~/game-event/type/EngineFact";
import { releaseOwnerInputsFx } from "~/production-input/fx/releaseOwnerInputsFx";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import type { ReservedRuntimeItemSchema } from "~/game-runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { makeUnitDepletionRandomFx } from "~/production-job/fx/makeUnitDepletionRandomFx";
import { resolveOutcomeTableFx } from "~/outcome/fx/resolveOutcomeTableFx";
import { applyOutcomeTableFx } from "~/outcome/fx/applyOutcomeTableFx";
import type { AppliedOutcome } from "~/outcome/type/AppliedOutcome";
import type { planBestEffortDropPlacementFx } from "~/item-placement/fx/planBestEffortDropPlacementFx";
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
		readonly facts: readonly EngineFact[];
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
	if (!context.runtime.items.some((item) => item.id === context.owner.id))
		return {
			runtime: context.runtime,
			facts: [],
		} satisfies settleJobRuntimeFx.Result;
	const depleted = context.owner.item.units !== undefined && context.owner.remainingUnits === 0;
	let draft = context.runtime;
	let removalEvents: readonly GameEventSchema.Type[] = [];
	let lineEffects: readonly AppliedOutcome[] = [];
	let depletionEffects: readonly AppliedOutcome[] = [];
	let depletionDiscarded: readonly planBestEffortDropPlacementFx.Discarded[] = [];

	if (depleted) {
		const withoutDepletedOwnerQueue = {
			...draft,
			jobQueue: draft.jobQueue.filter((request) => request.ownerItemId !== context.owner.id),
		};
		const removed = yield* removeRuntimeItemIdentityFx({
			ownershipRuntime: yield* (yield* RuntimeFx).read,
			item: context.owner,
			runtime: withoutDepletedOwnerQueue,
		});
		draft = removed.runtime;
		removalEvents = removed.events;
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
		lineEffects = placement.effects;
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
			depletionEffects = placement.effects;
			depletionDiscarded = placement.discarded;
			draft = withDepletionOutcome;
		}
	}
	let releasedInputEvents: readonly GameEventSchema.Type[] = [];
	if (depleted) {
		const releasedInputs = yield* releaseOwnerInputsFx({
			owner: context.owner,
			origin: context.owner.location,
			overflow: context.overflow,
			runtime: draft,
		});
		releasedInputEvents = releasedInputs.events;
		draft = releasedInputs.runtime;
	}

	const releasedReservations = yield* releaseJobReservationsFx({
		origin: context.owner.location,
		originItemId: context.owner.id,
		reservations: context.reservations,
		overflow: context.overflow,
		runtime: draft,
	});
	const finalRuntime = releasedReservations.runtime;
	const replacementItemIds = depletionEffects.flatMap((effect) =>
		effect.type === "item" ? effect.placement.spawn.map((spawned) => spawned.id) : [],
	);
	const facts: EngineFact[] = [
		...removalEvents,
		...(depleted
			? [
					{
						type: "lifecycle:settled",
						cause: "depleted",
						itemId: context.owner.id,
						itemUid: context.owner.item.uid,
						location: context.owner.location,
						visible: true,
						replacementItemIds,
					} satisfies EngineFact,
				]
			: []),
		...(lineEffects.length > 0
			? [
					{
						type: "outcome:applied",
						originItemId: context.owner.id,
						effects: lineEffects,
					} satisfies EngineFact,
				]
			: []),
		...(depletionEffects.length > 0
			? [
					{
						type: "outcome:applied",
						originItemId: context.owner.id,
						effects: depletionEffects,
					} satisfies EngineFact,
				]
			: []),
		...depletionDiscarded.map(
			(loss): GameEventSchema.Type => ({
				type: GameEventEnumSchema.enum.ItemDiscarded,
				ownerItemId: context.owner.id,
				itemUid: loss.itemUid,
				quantity: loss.quantity,
				source: "depletion-outcome",
				reason: loss.reason,
			}),
		),
		...releasedInputEvents,
		...releasedReservations.events,
	];

	return {
		facts,
		runtime: finalRuntime,
	} satisfies settleJobRuntimeFx.Result;
});
