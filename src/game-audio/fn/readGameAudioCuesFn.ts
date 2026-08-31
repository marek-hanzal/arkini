import { match } from "ts-pattern";

import type { GameEventBatchSchema } from "~/game-event/schema/GameEventBatchSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";

export namespace readGameAudioCuesFn {
	export type Kind =
		| "space-change"
		| "job-start"
		| "job-complete"
		| "merge"
		| "expire"
		| "spawn"
		| "place"
		| "stack"
		| "split"
		| "consume"
		| "store"
		| "charge"
		| "deplete"
		| "remove";

	export interface Result {
		readonly kind: Kind;
		readonly strength: number;
	}
}

type GameEvent = GameEventBatchSchema.Type["events"][number];

const maximumBatchCues = 6;

const cuePriority: Record<readGameAudioCuesFn.Kind, number> = {
	"space-change": 1,
	"job-start": 2,
	"job-complete": 3,
	merge: 3,
	expire: 3,
	spawn: 2,
	place: 2,
	stack: 2,
	split: 2,
	consume: 2,
	store: 2,
	charge: 2,
	deplete: 3,
	remove: 3,
};

const clampStrengthFn = (strength: number) => Math.min(3, Math.max(1, strength));

const strengthForQuantityFn = (quantity: number) =>
	clampStrengthFn(1 + Math.log2(Math.max(1, quantity)));

const cueFn = (kind: readGameAudioCuesFn.Kind, strength: number): readGameAudioCuesFn.Result => ({
	kind,
	strength: clampStrengthFn(strength),
});

const readGameAudioCueFn = (event: GameEvent): readGameAudioCuesFn.Result =>
	match(event)
		.with(
			{
				type: GameEventEnumSchema.enum.CurrentSpaceChanged,
			},
			() => cueFn("space-change", 1),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.JobStarted,
			},
			() => cueFn("job-start", 1),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.JobCompleted,
			},
			() => cueFn("job-complete", 2),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemMerged,
			},
			() => cueFn("merge", 2),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemExpired,
			},
			(event) => cueFn("expire", strengthForQuantityFn(event.quantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemSpawned,
			},
			(event) => cueFn("spawn", strengthForQuantityFn(event.quantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemPlaced,
			},
			(event) => cueFn("place", strengthForQuantityFn(event.quantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemStacked,
			},
			(event) =>
				cueFn("stack", strengthForQuantityFn(event.quantity - event.previousQuantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemSplit,
			},
			(event) =>
				cueFn("split", strengthForQuantityFn(event.previousQuantity - event.quantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemConsumed,
			},
			(event) => cueFn("consume", strengthForQuantityFn(event.consumedQuantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemInputStored,
			},
			(event) => cueFn("store", strengthForQuantityFn(event.storedQuantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemChargeSpent,
			},
			(event) => cueFn("charge", event.previousCharges - event.resultingCharges),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemDepleted,
			},
			(event) => cueFn("deplete", strengthForQuantityFn(event.previousQuantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemExplicitlyRemoved,
			},
			(event) => cueFn("remove", strengthForQuantityFn(event.quantity)),
		)
		.exhaustive();

const coalesceCuesFn = (
	events: ReadonlyArray<GameEvent>,
): ReadonlyArray<readGameAudioCuesFn.Result> => {
	const cues: Array<readGameAudioCuesFn.Result> = [];
	const indexByKind = new Map<readGameAudioCuesFn.Kind, number>();

	for (const event of events) {
		const next = readGameAudioCueFn(event);
		const existingIndex = indexByKind.get(next.kind);
		if (existingIndex === undefined) {
			indexByKind.set(next.kind, cues.length);
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
				cuePriority[right.candidate.kind] - cuePriority[left.candidate.kind] ||
				left.index - right.index,
		);

	return ranked
		.slice(0, maximumBatchCues)
		.sort((left, right) => left.index - right.index)
		.map(({ candidate }) => candidate);
};
