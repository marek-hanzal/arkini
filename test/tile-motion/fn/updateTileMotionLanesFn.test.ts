import { describe, expect, it } from "vitest";

import type {
	TileInputMotionCue,
	TileMotionCue,
	TileSpawnMotionCue,
	TileStackMotionCue,
	TileSwapMotionCue,
} from "~/tile-presentation/type/TileMotionCue";
import { updateTileMotionLanesFn } from "~/tile-motion/fn/updateTileMotionLanesFn";

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

const inputCue = ({
	eventIndex,
	sourceActorId = "runtime:source",
	targetActorId = "runtime:owner",
}: {
	readonly eventIndex: number;
	readonly sourceActorId?: string;
	readonly targetActorId?: string;
}): TileInputMotionCue => ({
	canonicalItemId: "water",
	eventIndex: 0,
	kind: "input",
	originActorId: sourceActorId,
	originLocation: location(0),
	previousQuantity: 1,
	resultingQuantity: 0,
	sequence: 7 + eventIndex,
	sourceActorId,
	staggerIndex: 0,
	storedQuantity: 1,
	targetActorId,
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

const complete = (state: ReturnType<typeof enqueue>, cue: TileMotionCue) =>
	updateTileMotionLanesFn({
		action: {
			cue,
			type: "complete",
		},
		state,
	});

const cueKeys = (...cues: ReadonlyArray<TileMotionCue>) =>
	cues.map(({ eventIndex, sequence }) => `${sequence}:${eventIndex}`).join(",");

const expectLaneCueKeys = (state: ReturnType<typeof enqueue>, active: string, pending: string) => {
	expect(cueKeys(...state.active)).toBe(active);
	expect(cueKeys(...state.pending)).toBe(pending);
};

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

	it("starts owner output only after every independently flying input contacts", () => {
		const first = inputCue({
			eventIndex: 0,
			sourceActorId: "runtime:first-source",
		});
		const second = inputCue({
			eventIndex: 1,
			sourceActorId: "runtime:second-source",
		});
		const output = spawnCue({
			actorId: "runtime:output",
			originActorId: "runtime:owner",
			sequence: 12,
		});

		const launched = enqueue([
			first,
			second,
			output,
		]);
		expectLaneCueKeys(launched, cueKeys(first, second), cueKeys(output));

		const afterFirstContact = complete(launched, first);
		expectLaneCueKeys(afterFirstContact, cueKeys(second), cueKeys(output));
		expectLaneCueKeys(complete(afterFirstContact, second), cueKeys(output), "");
	});

	it("does not let a later input bypass an older blocked stack on the same actor", () => {
		const blocker = inputCue({
			eventIndex: 0,
			sourceActorId: "runtime:producer",
			targetActorId: "runtime:blocking-owner",
		});
		const stack = stackCue({
			eventIndex: 1,
			originActorId: "runtime:producer",
			targetActorId: "runtime:shared",
		});
		const input = inputCue({
			eventIndex: 2,
			sourceActorId: "runtime:shared",
			targetActorId: "runtime:other-owner",
		});

		const state = enqueue([
			blocker,
			stack,
			input,
		]);

		expectLaneCueKeys(state, cueKeys(blocker), cueKeys(stack, input));
	});
});
