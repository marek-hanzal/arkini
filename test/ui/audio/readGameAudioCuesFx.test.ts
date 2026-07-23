import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameEventEnumSchema, type useGameEvents } from "~/bridge/event/useGameEvents";
import { readGameAudioCuesFx } from "~/ui/audio/readGameAudioCuesFx";

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

describe("readGameAudioCuesFx", () => {
	it("preserves semantic order while coalescing repeated event kinds", () => {
		const batch = {
			events: [
				{
					type: GameEventEnumSchema.enum.JobCompleted,
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
		} satisfies useGameEvents.Batch;

		expect(Effect.runSync(readGameAudioCuesFx(batch))).toEqual([
			{
				kind: "job-complete",
				strength: 2,
			},
			{
				kind: "spawn",
				strength: 3,
			},
			{
				kind: "stack",
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
					jobId: "job:1",
					ownerItemId: "runtime:producer",
					lineId: "line:1",
					source: "explicit",
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
					jobId: "job:1",
					ownerItemId: "runtime:producer",
					lineId: "line:1",
				},
				{
					type: GameEventEnumSchema.enum.ItemDepleted,
					itemId: "runtime:charged",
					canonicalItemId: "item:charged",
					location: boardLocation,
					previousQuantity: 1,
					resultingQuantity: 0,
				},
			],
		} satisfies useGameEvents.Batch;

		expect(Effect.runSync(readGameAudioCuesFx(batch)).map(({ kind }) => kind)).toEqual([
			"job-start",
			"spawn",
			"place",
			"stack",
			"job-complete",
			"deplete",
		]);
	});
});
