import { describe, expect, it } from "vitest";

import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventBatchSchema } from "~/game-event/schema/GameEventBatchSchema";
import { readGameAudioCuesFn } from "~/game-audio/fn/readGameAudioCuesFn";

const boardLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

const inputLocation = {
	scope: "input" as const,
	ownerItemId: "runtime:producer",
	lineId: "line:1",
	inputIndex: 0,
};

const producer = ItemSchema.parse({
	uid: "producer",
	id: "producer",
	title: "Producer",
	ui: "default",
	maxStackSize: 1,
	artwork: {
		scale: 1,
		default: [
			"artwork:producer",
		],
	},
});
const simpleProducer = {
	...producer,
	uid: "simple",
	id: "simple",
	ui: "simple" as const,
};
const items = {
	producer,
	simple: simpleProducer,
};

describe("readGameAudioCuesFn", () => {
	it("projects accepted queue work and explicit queue clearing", () => {
		expect(
			readGameAudioCuesFn(
				{
					events: [
						{
							type: "job:queued",
							requestId: "request:1",
							canonicalItemId: "producer",
							ownerItemId: "runtime:producer",
							lineId: "line:1",
						},
						{
							type: "job-queue:cleared",
							canonicalItemId: "producer",
							ownerItemId: "runtime:producer",
							clearedRequestCount: 4,
						},
					],
				},
				items,
			),
		).toEqual([
			{
				event: GameEventEnumSchema.enum.JobQueued,
				strength: 1,
			},
			{
				event: GameEventEnumSchema.enum.JobQueueCleared,
				strength: 3,
			},
		]);
	});

	it("silences the simple-item job family before coalescing mixed-owner cues", () => {
		const owner = {
			ownerItemId: "runtime:producer",
			canonicalItemId: "producer",
		};
		const job = {
			...owner,
			jobId: "job:1",
			lineId: "line:1",
		};
		const batch = {
			events: [
				{
					...owner,
					type: "job:queued",
					requestId: "request:1",
					lineId: "line:1",
				},
				{
					...job,
					type: "job:started",
				},
				{
					...owner,
					type: "line-input:autofill-started",
					lineId: "line:1",
					scheduledQuantity: 2,
				},
				{
					...job,
					type: "job:completed",
				},
				{
					...job,
					type: "job:aborted",
					reason: "owner-removed",
				},
				{
					...owner,
					type: "job-queue:cleared",
					clearedRequestCount: 2,
				},
			],
		} satisfies GameEventBatchSchema.Type;
		const simpleEvents = batch.events.map((event) => ({
			...event,
			canonicalItemId: "simple",
			ownerItemId: "runtime:simple",
		}));
		const expected = [
			{
				event: GameEventEnumSchema.enum.JobQueued,
				strength: 1,
			},
			{
				event: GameEventEnumSchema.enum.JobStarted,
				strength: 1,
			},
			{
				event: GameEventEnumSchema.enum.LineInputAutofillStarted,
				strength: 2,
			},
			{
				event: GameEventEnumSchema.enum.JobCompleted,
				strength: 2,
			},
			{
				event: GameEventEnumSchema.enum.JobAborted,
				strength: 2,
			},
			{
				event: GameEventEnumSchema.enum.JobQueueCleared,
				strength: 2,
			},
		];
		expect(readGameAudioCuesFn(batch, items)).toEqual(expected);
		expect(
			readGameAudioCuesFn(
				{
					events: simpleEvents,
				},
				items,
			),
		).toEqual([]);
		expect(
			readGameAudioCuesFn(
				{
					events: [
						...simpleEvents,
						...batch.events,
					],
				},
				items,
			),
		).toEqual(expected);
	});

	it("projects every committed event and leaves silence to authored runtime assignment", () => {
		expect(
			readGameAudioCuesFn(
				{
					events: [
						{
							type: "job:aborted",
							canonicalItemId: "producer",
							jobId: "job:1",
							ownerItemId: "runtime:producer",
							lineId: "line:1",
							reason: "owner-removed",
						},
						{
							type: "item:discarded",
							ownerItemId: "runtime:producer",
							canonicalItemId: "item:output",
							quantity: 2,
							source: "expiry-output",
							reason: "board:full",
						},
					],
				},
				{},
			),
		).toEqual([
			{
				event: GameEventEnumSchema.enum.JobAborted,
				strength: 2,
			},
			{
				event: GameEventEnumSchema.enum.ItemDiscarded,
				strength: 2,
			},
		]);
	});
	it("preserves semantic order while coalescing repeated event kinds", () => {
		const batch = {
			events: [
				{
					type: GameEventEnumSchema.enum.JobCompleted,
					canonicalItemId: "producer",
					jobId: "job:1",
					ownerItemId: "runtime:producer",
					lineId: "line:1",
				},
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: "runtime:first",
					canonicalItemId: "item:first",
					originItemId: "runtime:producer",
					location: boardLocation,
					quantity: 1,
				},
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: "runtime:second",
					canonicalItemId: "item:second",
					originItemId: "runtime:producer",
					location: boardLocation,
					quantity: 4,
				},
				{
					type: GameEventEnumSchema.enum.ItemStacked,
					itemId: "runtime:stack",
					canonicalItemId: "item:stack",
					originItemId: "runtime:first",
					location: boardLocation,
					previousQuantity: 1,
					quantity: 2,
				},
				{
					type: GameEventEnumSchema.enum.ItemStacked,
					itemId: "runtime:stack",
					canonicalItemId: "item:stack",
					originItemId: "runtime:second",
					location: boardLocation,
					previousQuantity: 2,
					quantity: 4,
				},
			],
		} satisfies GameEventBatchSchema.Type;

		expect(readGameAudioCuesFn(batch, {})).toEqual([
			{
				event: GameEventEnumSchema.enum.JobCompleted,
				strength: 2,
			},
			{
				event: GameEventEnumSchema.enum.ItemSpawned,
				strength: 3,
			},
			{
				event: GameEventEnumSchema.enum.ItemStacked,
				strength: 2.25,
			},
		]);
	});

	it("caps dense batches while retaining high-priority terminal feedback", () => {
		const batch = {
			events: [
				{
					type: GameEventEnumSchema.enum.CurrentSpaceChanged,
					previousSpace: 0,
					currentSpace: 1,
				},
				{
					type: GameEventEnumSchema.enum.JobStarted,
					canonicalItemId: "producer",
					jobId: "job:1",
					ownerItemId: "runtime:producer",
					lineId: "line:1",
				},
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: "runtime:spawn",
					canonicalItemId: "item:spawn",
					originItemId: "runtime:producer",
					location: boardLocation,
					quantity: 1,
				},
				{
					type: GameEventEnumSchema.enum.ItemPlaced,
					itemId: "runtime:placed",
					canonicalItemId: "item:placed",
					originItemId: "runtime:producer",
					previousLocation: inputLocation,
					location: boardLocation,
					quantity: 1,
				},
				{
					type: GameEventEnumSchema.enum.ItemStacked,
					itemId: "runtime:stack",
					canonicalItemId: "item:stack",
					originItemId: "runtime:spawn",
					location: boardLocation,
					previousQuantity: 1,
					quantity: 2,
				},
				{
					type: GameEventEnumSchema.enum.ItemConsumed,
					sourceItemId: "runtime:source",
					canonicalItemId: "item:source",
					sourceLocation: inputLocation,
					previousQuantity: 2,
					consumedQuantity: 1,
					resultingQuantity: 1,
				},
				{
					type: GameEventEnumSchema.enum.JobCompleted,
					canonicalItemId: "producer",
					jobId: "job:1",
					ownerItemId: "runtime:producer",
					lineId: "line:1",
				},
				{
					type: GameEventEnumSchema.enum.ItemDepleted,
					itemId: "runtime:spent",
					canonicalItemId: "item:spent",
					location: boardLocation,
					previousQuantity: 1,
					resultingQuantity: 0,
				},
				{
					type: GameEventEnumSchema.enum.ItemDisappeared,
					itemId: "runtime:spent",
					canonicalItemId: "item:spent",
					location: boardLocation,
					quantity: 1,
				},
			],
		} satisfies GameEventBatchSchema.Type;

		expect(readGameAudioCuesFn(batch, {}).map(({ event }) => event)).toEqual([
			GameEventEnumSchema.enum.JobStarted,
			GameEventEnumSchema.enum.ItemSpawned,
			GameEventEnumSchema.enum.ItemPlaced,
			GameEventEnumSchema.enum.JobCompleted,
			GameEventEnumSchema.enum.ItemDepleted,
			GameEventEnumSchema.enum.ItemDisappeared,
		]);
	});
});
