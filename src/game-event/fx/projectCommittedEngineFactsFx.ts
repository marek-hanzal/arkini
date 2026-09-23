import { Effect, Option } from "effect";

import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { EngineFact } from "~/game-event/type/EngineFact";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { AppliedOutcome } from "~/outcome/type/AppliedOutcome";

type LifecycleFact = Extract<
	EngineFact,
	{
		type: "lifecycle:settled";
	}
>;
type Candidate = GameEventSchema.Type | LifecycleFact;

const projectTemplateEventsFn = (effect: AppliedOutcome.Template): GameEventSchema.Type[] => [
	...effect.removed.map(
		(snapshot): GameEventSchema.Type => ({
			type: GameEventEnumSchema.enum.ItemRemoved,
			snapshot,
		}),
	),
	{
		type: GameEventEnumSchema.enum.BoardTemplateApplied,
		space: effect.space,
		templateUid: effect.templateUid,
	},
];

/** Turns calculation receipts into public events once the complete Runtime draft is known. */
export const projectCommittedEngineFactsFx = Effect.fn("projectCommittedEngineFactsFx")(function* ({
	previousRuntime,
	runtime,
	facts,
}: {
	readonly previousRuntime: RuntimeSchema.Type;
	readonly runtime: RuntimeSchema.Type;
	readonly facts: readonly EngineFact[];
}) {
	const finalItemsById = new Map(
		runtime.items.map((item) => [
			item.id,
			item,
		]),
	);
	const candidates: Candidate[] = [];
	for (const fact of facts) {
		if (fact.type === "outcome:applied") {
			for (const effect of fact.effects) {
				if (effect.type === "template") {
					candidates.push(...projectTemplateEventsFn(effect));
					continue;
				}
				for (const spawned of effect.placement.spawn) {
					const item = Option.getOrUndefined(narrowBoardRuntimeItemFn(spawned));
					if (item === undefined)
						return yield* Effect.die(
							new Error(`Outcome spawned ${spawned.id} outside Board.`),
						);
					candidates.push({
						type: GameEventEnumSchema.enum.ItemSpawned,
						itemId: item.id,
						itemUid: item.item.uid,
						originItemId: fact.originItemId,
						location: item.location,
					});
				}
			}
			continue;
		}
		if (fact.type === "template:applied") {
			candidates.push(...projectTemplateEventsFn(fact.effect));
			continue;
		}
		if (fact.type === "autofill:admitted") {
			const quantity = fact.deliveries.filter(({ id, revision }) => {
				const item = finalItemsById.get(id);
				return (
					item?.revision === revision &&
					item.location.scope === "delivery" &&
					item.location.phase === "outbound" &&
					item.location.target.kind === "line-input" &&
					item.location.target.ownerItemId === fact.ownerItemId &&
					item.location.target.lineId === fact.lineId
				);
			}).length;
			if (quantity > 0)
				candidates.push({
					type: GameEventEnumSchema.enum.LineInputAutofillStarted,
					ownerItemId: fact.ownerItemId,
					itemUid: fact.itemUid,
					lineId: fact.lineId,
					scheduledQuantity: quantity,
				});
			continue;
		}
		if (fact.type === "job:admitted") {
			candidates.push({
				type: GameEventEnumSchema.enum.JobStarted,
				jobId: fact.jobId,
				ownerItemId: fact.ownerItemId,
				itemUid: fact.itemUid,
				lineId: fact.lineId,
			});
			continue;
		}
		candidates.push(fact);
	}

	const previousIds = new Set(previousRuntime.items.map((item) => item.id));
	const liveOrSettledJobIds = new Set(runtime.jobs.map((job) => job.id));
	for (const candidate of candidates) {
		if (
			candidate.type === GameEventEnumSchema.enum.JobCompleted ||
			candidate.type === GameEventEnumSchema.enum.JobAborted
		)
			liveOrSettledJobIds.add(candidate.jobId);
	}
	const capturedIds = new Set<string>();
	const committed: Candidate[] = [];
	for (let index = candidates.length - 1; index >= 0; index -= 1) {
		const candidate = candidates[index];
		// A same-commit birth and death never exposed its identity to subscribers.
		if (
			candidate.type === "lifecycle:settled" &&
			!previousIds.has(candidate.itemId) &&
			!finalItemsById.has(candidate.itemId)
		)
			continue;
		if (
			candidate.type === GameEventEnumSchema.enum.ItemSpawned ||
			candidate.type === GameEventEnumSchema.enum.ItemPlaced
		) {
			const item = finalItemsById.get(candidate.itemId);
			if (
				item?.item.uid !== candidate.itemUid ||
				item.location.scope !== "board" ||
				item.location.space !== candidate.location.space ||
				item.location.position.x !== candidate.location.position.x ||
				item.location.position.y !== candidate.location.position.y
			)
				continue;
		}
		if (
			candidate.type === GameEventEnumSchema.enum.JobStarted &&
			!liveOrSettledJobIds.has(candidate.jobId)
		)
			continue;
		if (candidate.type === GameEventEnumSchema.enum.ItemRemoved) {
			if (
				!previousIds.has(candidate.snapshot.id) ||
				finalItemsById.has(candidate.snapshot.id) ||
				capturedIds.has(candidate.snapshot.id)
			)
				continue;
			capturedIds.add(candidate.snapshot.id);
		}
		committed.push(candidate);
	}
	committed.reverse();
	const committedSpawnIds = new Set(
		committed.flatMap((candidate) =>
			candidate.type === GameEventEnumSchema.enum.ItemSpawned
				? [
						candidate.itemId,
					]
				: [],
		),
	);
	const events: GameEventSchema.Type[] = [];
	for (const candidate of committed) {
		if (candidate.type !== "lifecycle:settled") {
			if (candidate.type !== GameEventEnumSchema.enum.CurrentSpaceChanged)
				events.push(candidate);
			continue;
		}
		if (candidate.cause === "depleted" || candidate.cause === "expired")
			events.push({
				type:
					candidate.cause === "depleted"
						? GameEventEnumSchema.enum.ItemDepleted
						: GameEventEnumSchema.enum.ItemExpired,
				itemId: candidate.itemId,
				itemUid: candidate.itemUid,
				location: candidate.location,
			});
		if (
			candidate.visible &&
			!finalItemsById.has(candidate.itemId) &&
			!candidate.replacementItemIds.some((id) => committedSpawnIds.has(id))
		)
			events.push({
				type: GameEventEnumSchema.enum.ItemDisappeared,
				itemId: candidate.itemId,
				itemUid: candidate.itemUid,
				location: candidate.location,
			});
	}
	if (previousRuntime.currentSpace !== runtime.currentSpace)
		events.push({
			type: GameEventEnumSchema.enum.CurrentSpaceChanged,
			previousSpace: previousRuntime.currentSpace,
			currentSpace: runtime.currentSpace,
		});
	return events;
});
