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
		readonly ownerExit?: {
			readonly cause: "expired" | "depleted";
			readonly overflow?: "discard";
		};
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
 * A terminal line frees its owner's cell before outcome and returns; abort supplies no line outcome.
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
	const removeOwner = context.ownerExit !== undefined;
	const overflow = context.ownerExit?.overflow ?? context.overflow;
	let draft = context.runtime;
	let removalEvents: readonly GameEventSchema.Type[] = [];
	let lineEffects: readonly AppliedOutcome[] = [];
	let lineDiscarded: readonly planBestEffortDropPlacementFx.Discarded[] = [];

	if (removeOwner) {
		const withoutOwnerQueue = {
			...draft,
			jobQueue: draft.jobQueue.filter((request) => request.ownerItemId !== context.owner.id),
		};
		const removed = yield* removeRuntimeItemIdentityFx({
			ownershipRuntime: yield* (yield* RuntimeFx).read,
			item: context.owner,
			runtime: withoutOwnerQueue,
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
			overflow,
			runtime: draft,
		});
		lineEffects = placement.effects;
		lineDiscarded = placement.discarded;
		draft = withLineOutcome;
	}

	let releasedInputEvents: readonly GameEventSchema.Type[] = [];
	if (removeOwner) {
		const releasedInputs = yield* releaseOwnerInputsFx({
			owner: context.owner,
			origin: context.owner.location,
			overflow,
			runtime: draft,
		});
		releasedInputEvents = releasedInputs.events;
		draft = releasedInputs.runtime;
	}

	const releasedReservations = yield* releaseJobReservationsFx({
		origin: context.owner.location,
		originItemId: context.owner.id,
		reservations: context.reservations,
		overflow,
		runtime: draft,
	});
	const finalRuntime = releasedReservations.runtime;
	const replacementItemIds = lineEffects.flatMap((effect) =>
		effect.type === "item" ? effect.placement.spawn.map((spawned) => spawned.id) : [],
	);
	const facts: EngineFact[] = [
		...removalEvents,
		...(removeOwner
			? [
					{
						type: "lifecycle:settled",
						cause: context.ownerExit?.cause ?? "expired",
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
		...lineDiscarded.map(
			(loss): GameEventSchema.Type => ({
				type: GameEventEnumSchema.enum.ItemDiscarded,
				ownerItemId: context.owner.id,
				itemUid: loss.itemUid,
				quantity: loss.quantity,
				source:
					context.ownerExit?.cause === "depleted"
						? "depletion-outcome"
						: "expiry-outcome",
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
