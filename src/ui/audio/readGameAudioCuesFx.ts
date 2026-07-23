import { Effect } from "effect";
import { match } from "ts-pattern";

import { GameEventEnumSchema, type useGameEvents } from "~/bridge/event/useGameEvents";

export namespace readGameAudioCuesFx {
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

type GameEvent = useGameEvents.Batch["events"][number];

const maximumBatchCues = 6;

const cuePriority: Record<readGameAudioCuesFx.Kind, number> = {
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

const clampStrength = (strength: number) => Math.min(3, Math.max(1, strength));

const strengthForQuantity = (quantity: number) =>
	clampStrength(1 + Math.log2(Math.max(1, quantity)));

const cue = (kind: readGameAudioCuesFx.Kind, strength: number): readGameAudioCuesFx.Result => ({
	kind,
	strength: clampStrength(strength),
});

const readGameAudioCue = (event: GameEvent): readGameAudioCuesFx.Result =>
	match(event)
		.with(
			{
				type: GameEventEnumSchema.enum.CurrentSpaceChanged,
			},
			() => cue("space-change", 1),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.JobStarted,
			},
			() => cue("job-start", 1),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.JobCompleted,
			},
			() => cue("job-complete", 2),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemMerged,
			},
			() => cue("merge", 2),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemExpired,
			},
			(event) => cue("expire", strengthForQuantity(event.quantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemSpawned,
			},
			(event) => cue("spawn", strengthForQuantity(event.quantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemPlaced,
			},
			(event) => cue("place", strengthForQuantity(event.quantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemStacked,
			},
			(event) => cue("stack", strengthForQuantity(event.quantity - event.previousQuantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemSplit,
			},
			(event) => cue("split", strengthForQuantity(event.previousQuantity - event.quantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemConsumed,
			},
			(event) => cue("consume", strengthForQuantity(event.consumedQuantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemInputStored,
			},
			(event) => cue("store", strengthForQuantity(event.storedQuantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemChargeSpent,
			},
			(event) => cue("charge", event.previousCharges - event.resultingCharges),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemDepleted,
			},
			(event) => cue("deplete", strengthForQuantity(event.previousQuantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemExplicitlyRemoved,
			},
			(event) => cue("remove", strengthForQuantity(event.quantity)),
		)
		.exhaustive();

const coalesceCues = (
	events: ReadonlyArray<GameEvent>,
): ReadonlyArray<readGameAudioCuesFx.Result> => {
	const cues: Array<readGameAudioCuesFx.Result> = [];
	const indexByKind = new Map<readGameAudioCuesFx.Kind, number>();

	for (const event of events) {
		const next = readGameAudioCue(event);
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
			strength: clampStrength(Math.max(existing.strength, next.strength) + 0.25),
		};
	}

	return cues;
};

/** Projects one committed event batch into a small, readable set of audio intentions. */
export const readGameAudioCuesFx = Effect.fn("readGameAudioCuesFx")((batch: useGameEvents.Batch) =>
	Effect.sync(() => {
		const cues = coalesceCues(batch.events);
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
	}),
);
