import { describe, expect, it } from "vitest";

import type {
	TileInputMotionCue,
	TileMotionCue,
	TileStackMotionCue,
} from "~/ui/pixi/motion/TileMotionCue";
import { readInteractionClaimsFn } from "~/ui/pixi/motion/fn/readInteractionClaimsFn";
import { readTileMotionActorClaimsFn } from "~/ui/tile/motion/fn/readTileMotionActorClaimsFn";
import { readTileMotionLaneClaimsFn } from "~/ui/tile/motion/fn/readTileMotionLaneClaimsFn";
import { readTileMotionStaggerDelaySecondsFn } from "~/ui/tile/motion/fn/readTileMotionStaggerDelaySecondsFn";
import { readUnsettledTileInputSourceQuantitiesFn } from "~/ui/tile/motion/fn/readUnsettledTileInputSourceQuantitiesFn";
import { updateTileMotionLanesFn } from "~/ui/tile/motion/fn/updateTileMotionLanesFn";

const board = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

const stackCue = ({
	eventIndex,
	quantity,
	targetActorId,
}: {
	readonly eventIndex: number;
	readonly quantity: number;
	readonly targetActorId: string;
}): TileStackMotionCue => ({
	kind: "stack",
	sequence: 7,
	eventIndex,
	staggerIndex: eventIndex,
	targetActorId,
	canonicalItemId: "water",
	quantity,
	originActorId: "runtime:producer",
	originLocation: board(0),
	targetLocation: board(1),
});

const inputCue = ({
	eventIndex,
	previousQuantity,
	sourceActorId = "runtime:source",
	targetActorId = "runtime:owner",
}: {
	readonly eventIndex: number;
	readonly previousQuantity: number;
	readonly sourceActorId?: string;
	readonly targetActorId?: string;
}): TileInputMotionCue => ({
	kind: "input",
	sequence: 7 + eventIndex,
	eventIndex: 0,
	staggerIndex: 0,
	sourceActorId,
	targetActorId,
	canonicalItemId: "water",
	previousQuantity,
	storedQuantity: 1,
	resultingQuantity: previousQuantity - 1,
	originActorId: sourceActorId,
	originLocation: board(0),
	targetLocation: board(1),
});

describe("pure tile motion contracts", () => {
	it("caps accumulated delivery stagger while preserving tight order", () => {
		expect(
			[
				0,
				1,
				2,
				3,
				4,
				5,
				20,
			].map((index) => readTileMotionStaggerDelaySecondsFn(index)),
		).toEqual([
			0,
			0.055,
			0.11,
			0.165,
			0.22,
			0.22,
			0.22,
		]);
	});

	it("claims both exact actors for a swap", () => {
		const swap = {
			kind: "swap",
			sequence: 2,
			eventIndex: 0,
			staggerIndex: 0,
			actorId: "runtime:target",
			counterpartActorId: "runtime:source",
			originActorId: "runtime:target",
			originLocation: board(1),
			targetLocation: board(0),
		} satisfies TileMotionCue;

		expect(readTileMotionActorClaimsFn(swap)).toEqual(
			new Set([
				"runtime:target",
				"runtime:source",
			]),
		);
	});

	it("retains delivery endpoints without blocking a producer's direct input", () => {
		const spawn = {
			kind: "spawn",
			sequence: 7,
			eventIndex: 0,
			staggerIndex: 0,
			actorId: "runtime:spawned",
			originActorId: "runtime:producer",
			originLocation: board(0),
			targetLocation: board(1),
		} satisfies TileMotionCue;
		const stack = stackCue({
			eventIndex: 1,
			quantity: 2,
			targetActorId: "runtime:stacked",
		});

		expect(readTileMotionActorClaimsFn(spawn)).toEqual(
			new Set([
				"runtime:spawned",
				"runtime:producer",
			]),
		);
		expect(readTileMotionActorClaimsFn(stack)).toEqual(
			new Set([
				"runtime:producer",
			]),
		);
		expect(
			readInteractionClaimsFn([
				spawn,
				stack,
			]),
		).toEqual(
			new Map([
				[
					"runtime:spawned",
					"handoff",
				],
			]),
		);

		const producerLane = {
			kind: "delivery-batch",
			actorId: "runtime:producer",
			batchKey: "7:runtime:producer",
		};
		expect(readTileMotionLaneClaimsFn(spawn)).toContainEqual(producerLane);
		expect(readTileMotionLaneClaimsFn(stack)).toContainEqual(producerLane);
	});

	it("keeps the delivered source click-only and exposes only its oldest unsettled quantity", () => {
		const cues = [
			inputCue({
				eventIndex: 0,
				previousQuantity: 7,
			}),
			inputCue({
				eventIndex: 1,
				previousQuantity: 6,
			}),
		];

		expect(readTileMotionActorClaimsFn(cues[0])).toEqual(
			new Set([
				"runtime:source",
				"runtime:owner",
			]),
		);
		expect(readInteractionClaimsFn(cues)).toEqual(
			new Map([
				[
					"runtime:source",
					"activation-only",
				],
			]),
		);
		expect(
			readUnsettledTileInputSourceQuantitiesFn({
				cues,
			}),
		).toEqual(
			new Map([
				[
					"runtime:source",
					7,
				],
			]),
		);
		expect(
			readUnsettledTileInputSourceQuantitiesFn({
				cues,
				revealedCueKeys: new Set([
					`${cues[0].sequence}:${cues[0].eventIndex}`,
				]),
			}),
		).toEqual(
			new Map([
				[
					"runtime:source",
					6,
				],
			]),
		);
		expect(
			readUnsettledTileInputSourceQuantitiesFn({
				cues: cues.slice(1),
			}),
		).toEqual(
			new Map([
				[
					"runtime:source",
					6,
				],
			]),
		);
		expect(
			readUnsettledTileInputSourceQuantitiesFn({
				cues: cues.slice(1),
				revealedCueKeys: new Set([
					`${cues[1].sequence}:${cues[1].eventIndex}`,
				]),
			}),
		).toEqual(
			new Map([
				[
					"runtime:source",
					5,
				],
			]),
		);
	});

	it("flies independent inputs together and starts owner output only after every contact", () => {
		const first = inputCue({
			eventIndex: 0,
			previousQuantity: 1,
			sourceActorId: "runtime:first-source",
		});
		const second = inputCue({
			eventIndex: 1,
			previousQuantity: 1,
			sourceActorId: "runtime:second-source",
		});
		const output = {
			actorId: "runtime:output",
			eventIndex: 0,
			kind: "spawn",
			originActorId: "runtime:owner",
			originLocation: board(1),
			sequence: 12,
			staggerIndex: 0,
			targetLocation: board(2),
		} satisfies TileMotionCue;

		const launched = updateTileMotionLanesFn({
			action: {
				cues: [
					first,
					second,
					output,
				],
				type: "enqueue",
			},
			state: {
				active: [],
				pending: [],
			},
		});
		expect(launched).toEqual({
			active: [
				first,
				second,
			],
			pending: [
				output,
			],
		});

		const afterFirstContact = updateTileMotionLanesFn({
			action: {
				cue: first,
				type: "complete",
			},
			state: launched,
		});
		expect(afterFirstContact).toEqual({
			active: [
				second,
			],
			pending: [
				output,
			],
		});

		expect(
			updateTileMotionLanesFn({
				action: {
					cue: second,
					type: "complete",
				},
				state: afterFirstContact,
			}),
		).toEqual({
			active: [
				output,
			],
			pending: [],
		});
	});

	it("does not let a later input bypass an older blocked stack on the same actor", () => {
		const blocker = inputCue({
			eventIndex: 0,
			previousQuantity: 1,
			sourceActorId: "runtime:producer",
			targetActorId: "runtime:blocking-owner",
		});
		const stack = stackCue({
			eventIndex: 1,
			quantity: 1,
			targetActorId: "runtime:shared",
		});
		const input = inputCue({
			eventIndex: 2,
			previousQuantity: 6,
			sourceActorId: "runtime:shared",
			targetActorId: "runtime:other-owner",
		});

		const state = updateTileMotionLanesFn({
			action: {
				cues: [
					blocker,
					stack,
					input,
				],
				type: "enqueue",
			},
			state: {
				active: [],
				pending: [],
			},
		});

		expect(state.active).toEqual([
			blocker,
		]);
		expect(state.pending).toEqual([
			stack,
			input,
		]);
	});
});
