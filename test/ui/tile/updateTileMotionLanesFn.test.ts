import { describe, expect, it } from "vitest";

import type {
	TileMotionCue,
	TileSpawnMotionCue,
	TileStackMotionCue,
	TileSwapMotionCue,
} from "~/tile-presentation/type/TileMotionCue";
import { updateTileMotionLanesFn } from "~/ui/tile/motion/fn/updateTileMotionLanesFn";

const location = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

const spawnCue = ({
	sequence,
	eventIndex = 0,
	staggerIndex = 0,
	originActorId = `runtime:origin:${sequence}`,
	actorId = `runtime:spawn:${sequence}`,
}: {
	readonly sequence: number;
	readonly eventIndex?: number;
	readonly staggerIndex?: number;
	readonly originActorId?: string;
	readonly actorId?: string;
}): TileSpawnMotionCue => ({
	kind: "spawn",
	sequence,
	eventIndex,
	staggerIndex,
	originActorId,
	actorId,
	originLocation: location(0),
	targetLocation: location(1),
});

const stackCue = ({
	eventIndex,
	originActorId,
	targetActorId,
}: {
	readonly eventIndex: number;
	readonly originActorId: string;
	readonly targetActorId: string;
}): TileStackMotionCue => ({
	kind: "stack",
	sequence: 7,
	eventIndex,
	staggerIndex: eventIndex,
	originActorId,
	targetActorId,
	canonicalItemId: "water",
	quantity: 1,
	originLocation: location(0),
	targetLocation: location(1),
});

const swapCue = ({
	sequence,
	actorId,
	counterpartActorId,
}: {
	readonly sequence: number;
	readonly actorId: string;
	readonly counterpartActorId: string;
}): TileSwapMotionCue => ({
	kind: "swap",
	sequence,
	eventIndex: 0,
	staggerIndex: 0,
	actorId,
	counterpartActorId,
	originActorId: actorId,
	originLocation: location(1),
	targetLocation: location(0),
});

const enqueue = (cues: ReadonlyArray<TileMotionCue>) =>
	updateTileMotionLanesFn({
		state: {
			active: [],
			pending: [],
		},
		action: {
			type: "enqueue",
			cues,
		},
	});

describe("updateTileMotionLanesFn", () => {
	it("runs independent actors concurrently and serializes a shared actor", () => {
		const first = spawnCue({
			sequence: 1,
		});
		const independent = spawnCue({
			sequence: 2,
		});
		const conflict = spawnCue({
			sequence: 3,
			originActorId: first.originActorId,
		});
		const state = enqueue([
			first,
			independent,
			conflict,
		]);

		expect(state.active).toEqual([
			first,
			independent,
		]);
		expect(state.pending).toEqual([
			conflict,
		]);
		expect(
			updateTileMotionLanesFn({
				state,
				action: {
					type: "complete",
					cue: first,
				},
			}).active,
		).toEqual([
			independent,
			conflict,
		]);
	});

	it("activates staggered deliveries from one committed producer batch together", () => {
		const originActorId = "runtime:producer";
		const targetActorId = "runtime:stack";
		const first = stackCue({
			eventIndex: 0,
			originActorId,
			targetActorId,
		});
		const second = stackCue({
			eventIndex: 1,
			originActorId,
			targetActorId,
		});
		const third = spawnCue({
			sequence: 7,
			eventIndex: 2,
			staggerIndex: 2,
			originActorId,
			actorId: "runtime:new-output",
		});

		expect(
			enqueue([
				first,
				second,
				third,
			]),
		).toEqual({
			active: [
				first,
				second,
				third,
			],
			pending: [],
		});
	});

	it("caps active lanes without discarding ordered pending work", () => {
		const state = enqueue(
			Array.from(
				{
					length: 48,
				},
				(_, index) =>
					spawnCue({
						sequence: index + 1,
					}),
			),
		);

		expect(state.active).toHaveLength(8);
		expect(state.pending).toHaveLength(40);
		expect(state.active[0]?.sequence).toBe(1);
		expect(state.pending[0]?.sequence).toBe(9);
		expect(state.pending.at(-1)?.sequence).toBe(48);
	});

	it("preserves first-seen order while deduplicating cue generations", () => {
		const first = spawnCue({
			sequence: 1,
		});
		const duplicateGeneration = spawnCue({
			sequence: 1,
			actorId: "runtime:duplicate",
			originActorId: "runtime:duplicate-origin",
		});
		const second = spawnCue({
			sequence: 2,
		});
		const state = enqueue([
			first,
			duplicateGeneration,
			second,
		]);

		expect(state).toEqual({
			active: [
				first,
				second,
			],
			pending: [],
		});
		expect(
			updateTileMotionLanesFn({
				state,
				action: {
					type: "enqueue",
					cues: [
						duplicateGeneration,
					],
				},
			}),
		).toEqual(state);
	});

	it("holds both exchanged actors exclusively for one swap", () => {
		const swap = swapCue({
			sequence: 1,
			actorId: "runtime:target",
			counterpartActorId: "runtime:source",
		});
		const targetConflict = spawnCue({
			sequence: 2,
			originActorId: "runtime:producer",
			actorId: "runtime:target",
		});
		const sourceConflict = spawnCue({
			sequence: 3,
			originActorId: "runtime:source",
			actorId: "runtime:other",
		});

		expect(
			enqueue([
				swap,
				targetConflict,
				sourceConflict,
			]),
		).toEqual({
			active: [
				swap,
			],
			pending: [
				targetConflict,
				sourceConflict,
			],
		});
	});
});
