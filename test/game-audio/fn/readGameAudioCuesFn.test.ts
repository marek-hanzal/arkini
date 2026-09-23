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
	lineUid: "line:1",
	inputIndex: 0,
};

const producer = ItemSchema.parse({
	uid: "producer",
	title: "Producer",
	ui: "default",

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
							itemUid: "producer",
							ownerItemId: "runtime:producer",
							lineUid: "line:1",
						},
						{
							type: "job-queue:cleared",
							itemUid: "producer",
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
			itemUid: "producer",
		};
		const job = {
			...owner,
			jobId: "job:1",
			lineUid: "line:1",
		};
		const batch = {
			events: [
				{
					...owner,
					type: "job:queued",
					requestId: "request:1",
					lineUid: "line:1",
				},
				{
					...job,
					type: "job:started",
				},
				{
					...owner,
					type: "line-input:autofill-started",
					lineUid: "line:1",
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
			itemUid: "simple",
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
							itemUid: "producer",
							jobId: "job:1",
							ownerItemId: "runtime:producer",
							lineUid: "line:1",
							reason: "owner-removed",
						},
						{
							type: "item:discarded",
							ownerItemId: "runtime:producer",
							itemUid: "item:output",
							quantity: 2,
							source: "expiry-outcome",
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
					itemUid: "producer",
					jobId: "job:1",
					ownerItemId: "runtime:producer",
					lineUid: "line:1",
				},
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: "runtime:first",
					itemUid: "item:first",
					originItemId: "runtime:producer",
					location: boardLocation,
				},
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: "runtime:second",
					itemUid: "item:second",
					originItemId: "runtime:producer",
					location: boardLocation,
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
				strength: 1.25,
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
					itemUid: "producer",
					jobId: "job:1",
					ownerItemId: "runtime:producer",
					lineUid: "line:1",
				},
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: "runtime:spawn",
					itemUid: "item:spawn",
					originItemId: "runtime:producer",
					location: boardLocation,
				},
				{
					type: GameEventEnumSchema.enum.ItemPlaced,
					itemId: "runtime:placed",
					itemUid: "item:placed",
					originItemId: "runtime:producer",
					previousLocation: inputLocation,
					location: boardLocation,
				},

				{
					type: GameEventEnumSchema.enum.ItemConsumed,
					sourceItemId: "runtime:source",
					itemUid: "item:source",
					sourceLocation: inputLocation,
				},
				{
					type: GameEventEnumSchema.enum.JobCompleted,
					itemUid: "producer",
					jobId: "job:1",
					ownerItemId: "runtime:producer",
					lineUid: "line:1",
				},
				{
					type: GameEventEnumSchema.enum.ItemDepleted,
					itemId: "runtime:spent",
					itemUid: "item:spent",
					location: boardLocation,
				},
				{
					type: GameEventEnumSchema.enum.ItemDisappeared,
					itemId: "runtime:spent",
					itemUid: "item:spent",
					location: boardLocation,
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
