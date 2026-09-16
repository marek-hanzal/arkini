import { match } from "ts-pattern";

import type { GameEventBatchSchema } from "~/game-event/schema/GameEventBatchSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";

export namespace readGameAudioCuesFn {
	export interface Result {
		readonly event: GameEventEnumSchema.Type;
		readonly strength: number;
	}
}

type GameEvent = GameEventBatchSchema.Type["events"][number];

const maximumBatchCues = 6;

const cuePriority: Record<GameEventEnumSchema.Type, number> = {
	[GameEventEnumSchema.enum.CurrentSpaceChanged]: 1,
	[GameEventEnumSchema.enum.JobStarted]: 2,
	[GameEventEnumSchema.enum.JobCompleted]: 3,
	[GameEventEnumSchema.enum.JobAborted]: 3,
	[GameEventEnumSchema.enum.ItemDiscarded]: 3,
	[GameEventEnumSchema.enum.ItemMerged]: 3,
	[GameEventEnumSchema.enum.ItemExpired]: 3,
	[GameEventEnumSchema.enum.ItemSpawned]: 2,
	[GameEventEnumSchema.enum.ItemPlaced]: 2,
	[GameEventEnumSchema.enum.ItemStacked]: 2,
	[GameEventEnumSchema.enum.ItemSplit]: 2,
	[GameEventEnumSchema.enum.ItemConsumed]: 2,
	[GameEventEnumSchema.enum.ItemInputStored]: 2,
	[GameEventEnumSchema.enum.ItemUnitSpent]: 2,
	[GameEventEnumSchema.enum.ItemDepleted]: 3,
	[GameEventEnumSchema.enum.ItemExplicitlyRemoved]: 3,
};

const clampStrengthFn = (strength: number) => Math.min(3, Math.max(1, strength));

const strengthForQuantityFn = (quantity: number) =>
	clampStrengthFn(1 + Math.log2(Math.max(1, quantity)));

const cueFn = (event: GameEventEnumSchema.Type, strength: number): readGameAudioCuesFn.Result => ({
	event,
	strength: clampStrengthFn(strength),
});

const readGameAudioCueFn = (event: GameEvent): readGameAudioCuesFn.Result =>
	match(event)
		.with(
			{
				type: GameEventEnumSchema.enum.CurrentSpaceChanged,
			},
			() => cueFn(GameEventEnumSchema.enum.CurrentSpaceChanged, 1),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.JobStarted,
			},
			() => cueFn(GameEventEnumSchema.enum.JobStarted, 1),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.JobCompleted,
			},
			() => cueFn(GameEventEnumSchema.enum.JobCompleted, 2),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.JobAborted,
			},
			() => cueFn(GameEventEnumSchema.enum.JobAborted, 2),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemDiscarded,
			},
			(event) =>
				cueFn(
					GameEventEnumSchema.enum.ItemDiscarded,
					strengthForQuantityFn(event.quantity),
				),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemMerged,
			},
			() => cueFn(GameEventEnumSchema.enum.ItemMerged, 2),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemExpired,
			},
			(event) =>
				cueFn(GameEventEnumSchema.enum.ItemExpired, strengthForQuantityFn(event.quantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemSpawned,
			},
			(event) =>
				cueFn(GameEventEnumSchema.enum.ItemSpawned, strengthForQuantityFn(event.quantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemPlaced,
			},
			(event) =>
				cueFn(GameEventEnumSchema.enum.ItemPlaced, strengthForQuantityFn(event.quantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemStacked,
			},
			(event) =>
				cueFn(
					GameEventEnumSchema.enum.ItemStacked,
					strengthForQuantityFn(event.quantity - event.previousQuantity),
				),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemSplit,
			},
			(event) =>
				cueFn(
					GameEventEnumSchema.enum.ItemSplit,
					strengthForQuantityFn(event.previousQuantity - event.quantity),
				),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemConsumed,
			},
			(event) =>
				cueFn(
					GameEventEnumSchema.enum.ItemConsumed,
					strengthForQuantityFn(event.consumedQuantity),
				),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemInputStored,
			},
			(event) =>
				cueFn(
					GameEventEnumSchema.enum.ItemInputStored,
					strengthForQuantityFn(event.storedQuantity),
				),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemUnitSpent,
			},
			(event) =>
				cueFn(
					GameEventEnumSchema.enum.ItemUnitSpent,
					event.previousUnits - event.resultingUnits,
				),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemDepleted,
			},
			(event) =>
				cueFn(
					GameEventEnumSchema.enum.ItemDepleted,
					strengthForQuantityFn(event.previousQuantity),
				),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemExplicitlyRemoved,
			},
			(event) =>
				cueFn(
					GameEventEnumSchema.enum.ItemExplicitlyRemoved,
					strengthForQuantityFn(event.quantity),
				),
		)
		.exhaustive();

const coalesceCuesFn = (
	events: ReadonlyArray<GameEvent>,
): ReadonlyArray<readGameAudioCuesFn.Result> => {
	const cues: Array<readGameAudioCuesFn.Result> = [];
	const indexByEvent = new Map<GameEventEnumSchema.Type, number>();

	for (const event of events) {
		const next = readGameAudioCueFn(event);
		const existingIndex = indexByEvent.get(next.event);
		if (existingIndex === undefined) {
			indexByEvent.set(next.event, cues.length);
			cues.push(next);
			continue;
		}
		const existing = cues[existingIndex];
		if (existing === undefined) continue;
		cues[existingIndex] = {
			...existing,
			strength: clampStrengthFn(Math.max(existing.strength, next.strength) + 0.25),
		};
	}

	return cues;
};

/** Projects one committed event batch into a small, readable set of audio intentions. */
export const readGameAudioCuesFn = (
	batch: GameEventBatchSchema.Type,
): ReadonlyArray<readGameAudioCuesFn.Result> => {
	const cues = coalesceCuesFn(batch.events);
	if (cues.length <= maximumBatchCues) return cues;

	const ranked = cues
		.map((candidate, index) => ({
			candidate,
			index,
		}))
		.sort(
			(left, right) =>
				cuePriority[right.candidate.event] - cuePriority[left.candidate.event] ||
				left.index - right.index,
		);

	return ranked
		.slice(0, maximumBatchCues)
		.sort((left, right) => left.index - right.index)
		.map(({ candidate }) => candidate);
};
