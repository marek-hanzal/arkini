import { match } from "ts-pattern";

import type { GameEventBatchSchema } from "~/game-event/schema/GameEventBatchSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { GameAudioCue } from "~/game-audio/type/GameAudioCue";
import type { CommittedTransitionSchema } from "~/game-runtime/schema/CommittedTransitionSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { LocationSchema } from "~/item-location/schema/LocationSchema";

type GameEvent = GameEventBatchSchema.Type["events"][number];
type AudibleGameEvent = Exclude<
	GameEventEnumSchema.Type,
	"item:removed" | "board:template-applied"
>;
type GameEventAudioCue = GameAudioCue & {
	readonly event: AudibleGameEvent;
};

const maximumBatchCues = 6;

const cuePriority: Record<AudibleGameEvent, number> = {
	[GameEventEnumSchema.enum.CurrentSpaceChanged]: 1,
	[GameEventEnumSchema.enum.JobQueued]: 1,
	[GameEventEnumSchema.enum.LineInputAutofillStarted]: 2,
	[GameEventEnumSchema.enum.JobQueueCleared]: 2,
	[GameEventEnumSchema.enum.JobStarted]: 2,
	[GameEventEnumSchema.enum.JobCompleted]: 3,
	[GameEventEnumSchema.enum.JobAborted]: 3,
	[GameEventEnumSchema.enum.ItemDiscarded]: 3,
	[GameEventEnumSchema.enum.ItemMerged]: 3,
	[GameEventEnumSchema.enum.ItemExpired]: 3,
	[GameEventEnumSchema.enum.ItemSpawned]: 2,
	[GameEventEnumSchema.enum.ItemPlaced]: 2,
	[GameEventEnumSchema.enum.ItemSwapped]: 2,
	[GameEventEnumSchema.enum.ItemConsumed]: 2,
	[GameEventEnumSchema.enum.ItemInputStored]: 2,
	[GameEventEnumSchema.enum.ItemUnitSpent]: 2,
	[GameEventEnumSchema.enum.ItemDepleted]: 3,
	[GameEventEnumSchema.enum.ItemDisappeared]: 3,
};

const clampStrengthFn = (strength: number) => Math.min(3, Math.max(1, strength));

const strengthForQuantityFn = (quantity: number) =>
	clampStrengthFn(1 + Math.log2(Math.max(1, quantity)));

const cueFn = (event: AudibleGameEvent, strength: number): GameEventAudioCue => ({
	event,
	strength: clampStrengthFn(strength),
});

const readJobAudioCueFn = (
	event: {
		readonly type: AudibleGameEvent;
		readonly itemUid: string;
	},
	items: GameConfigSchema.Type["items"],
	strength: number,
): GameEventAudioCue | undefined =>
	items[event.itemUid]?.ui === "simple" ? undefined : cueFn(event.type, strength);

const readGameAudioCueFn = (
	event: GameEvent,
	items: GameConfigSchema.Type["items"],
): GameEventAudioCue | undefined =>
	match(event)
		.with(
			{
				type: GameEventEnumSchema.enum.BoardTemplateApplied,
			},
			() => undefined,
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemRemoved,
			},
			() => undefined,
		)
		.with(
			{
				type: GameEventEnumSchema.enum.CurrentSpaceChanged,
			},
			() => cueFn(GameEventEnumSchema.enum.CurrentSpaceChanged, 1),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.LineInputAutofillStarted,
			},
			(event) =>
				readJobAudioCueFn(event, items, strengthForQuantityFn(event.scheduledQuantity)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.JobQueued,
			},
			(event) => readJobAudioCueFn(event, items, 1),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.JobQueueCleared,
			},
			(event) =>
				readJobAudioCueFn(event, items, strengthForQuantityFn(event.clearedRequestCount)),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.JobStarted,
			},
			(event) => readJobAudioCueFn(event, items, 1),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.JobCompleted,
			},
			(event) => readJobAudioCueFn(event, items, 2),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.JobAborted,
			},
			(event) => readJobAudioCueFn(event, items, 2),
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
			() => cueFn(GameEventEnumSchema.enum.ItemExpired, 1),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemSpawned,
			},
			() => cueFn(GameEventEnumSchema.enum.ItemSpawned, 1),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemPlaced,
			},
			() => cueFn(GameEventEnumSchema.enum.ItemPlaced, 1),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemConsumed,
			},
			() => cueFn(GameEventEnumSchema.enum.ItemConsumed, 1),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemInputStored,
			},
			() => cueFn(GameEventEnumSchema.enum.ItemInputStored, 1),
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
			() => cueFn(GameEventEnumSchema.enum.ItemDepleted, 1),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemDisappeared,
			},
			() => cueFn(GameEventEnumSchema.enum.ItemDisappeared, 1),
		)
		.with(
			{
				type: GameEventEnumSchema.enum.ItemSwapped,
			},
			() => cueFn(GameEventEnumSchema.enum.ItemSwapped, 1),
		)
		.exhaustive();

const coalesceCuesFn = (
	events: ReadonlyArray<GameEvent>,
	items: GameConfigSchema.Type["items"],
): ReadonlyArray<GameEventAudioCue> => {
	const cues: Array<GameEventAudioCue> = [];
	const indexByEvent = new Map<GameEventEnumSchema.Type, number>();

	for (const event of events) {
		const next = readGameAudioCueFn(event, items);
		if (next === undefined) continue;
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
	items: GameConfigSchema.Type["items"],
): ReadonlyArray<GameAudioCue> => {
	const cues = coalesceCuesFn(batch.events, items);
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

/** Keeps committed world sounds in the presented Space, including terminal facts whose owner was removed. */
export const readVisibleGameAudioCuesFn = (
	transition: CommittedTransitionSchema.Type,
	items: GameConfigSchema.Type["items"],
): ReadonlyArray<GameAudioCue> => {
	const snapshots = [
		transition.previousRuntime,
		transition.runtime,
	].filter((runtime): runtime is RuntimeSchema.Type => runtime !== null);
	const ownerSpaceFn = (itemId: string, visited: Set<string>): number | undefined => {
		if (visited.has(itemId)) return undefined;
		visited.add(itemId);
		for (const runtime of snapshots) {
			const item = runtime.items.find((candidate) => candidate.id === itemId);
			if (item === undefined) continue;
			const location = item.location;
			if (location.scope === "board") return location.space;
			if (location.scope === "terminal") return location.origin.space;
			if (location.scope === "delivery") return location.origin.space;
			if (location.scope === "input") return ownerSpaceFn(location.ownerItemId, visited);
			const job = snapshots
				.flatMap((candidate) => candidate.jobs)
				.find((candidate) => candidate.id === location.jobId);
			if (job !== undefined) return ownerSpaceFn(job.ownerItemId, visited);
		}
		return undefined;
	};
	const spaceOfFn = (itemId: string) => ownerSpaceFn(itemId, new Set());
	const locationSpaceFn = (location: LocationSchema.Type): number | undefined => {
		if (location.scope === "board") return location.space;
		if (location.scope === "terminal") return location.origin.space;
		if (location.scope === "delivery") return location.origin.space;
		if (location.scope === "input") return spaceOfFn(location.ownerItemId);
		const job = snapshots
			.flatMap((runtime) => runtime.jobs)
			.find((candidate) => candidate.id === location.jobId);
		return job === undefined ? undefined : spaceOfFn(job.ownerItemId);
	};
	const visibleEvents = transition.events.filter((event) => {
		if (event.type === GameEventEnumSchema.enum.CurrentSpaceChanged) return true;
		if (
			event.type === GameEventEnumSchema.enum.BoardTemplateApplied ||
			event.type === GameEventEnumSchema.enum.ItemRemoved
		)
			return false;
		let space: number | undefined;
		switch (event.type) {
			case GameEventEnumSchema.enum.ItemExpired:
			case GameEventEnumSchema.enum.ItemSpawned:
			case GameEventEnumSchema.enum.ItemPlaced:
			case GameEventEnumSchema.enum.ItemUnitSpent:
			case GameEventEnumSchema.enum.ItemDepleted:
			case GameEventEnumSchema.enum.ItemDisappeared:
				space = locationSpaceFn(event.location);
				break;
			case GameEventEnumSchema.enum.ItemSwapped:
				space = event.sourceLocation.space;
				break;
			case GameEventEnumSchema.enum.ItemInputStored:
				space = event.previousSourceLocation.space;
				break;
			case GameEventEnumSchema.enum.ItemConsumed:
				space = spaceOfFn(event.sourceLocation.ownerItemId);
				break;
			case GameEventEnumSchema.enum.ItemMerged:
				space = spaceOfFn(event.sourceItemId);
				break;
			case GameEventEnumSchema.enum.LineInputAutofillStarted:
			case GameEventEnumSchema.enum.JobQueued:
			case GameEventEnumSchema.enum.JobQueueCleared:
			case GameEventEnumSchema.enum.JobStarted:
			case GameEventEnumSchema.enum.JobCompleted:
			case GameEventEnumSchema.enum.JobAborted:
			case GameEventEnumSchema.enum.ItemDiscarded:
				space = spaceOfFn(event.ownerItemId);
				break;
		}
		return space === transition.runtime.currentSpace;
	});
	return visibleEvents.length === 0
		? []
		: readGameAudioCuesFn(
				{
					events: visibleEvents,
				},
				items,
			);
};
