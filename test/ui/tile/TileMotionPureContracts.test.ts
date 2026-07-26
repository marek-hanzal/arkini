import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { TileMotionCue, TileStackMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import { readTileMotionActorClaimsFx } from "~/ui/tile/motion/readTileMotionActorClaimsFx";
import { readTileMotionLaneClaimsFx } from "~/ui/tile/motion/readTileMotionLaneClaimsFx";
import { readTileMotionStaggerDelaySecondsFx } from "~/ui/tile/motion/readTileMotionStaggerDelaySecondsFx";
import { readUnsettledTileStackQuantitiesFx } from "~/ui/tile/motion/readUnsettledTileStackQuantitiesFx";

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
			].map((index) => Effect.runSync(readTileMotionStaggerDelaySecondsFx(index))),
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

		expect(Effect.runSync(readTileMotionActorClaimsFx(swap))).toEqual(
			new Set([
				"runtime:target",
				"runtime:source",
			]),
		);
	});

	it("keeps a delivery producer in its lane without claiming its direct input", () => {
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

		expect(Effect.runSync(readTileMotionActorClaimsFx(spawn))).toEqual(
			new Set([
				"runtime:spawned",
			]),
		);
		expect(Effect.runSync(readTileMotionActorClaimsFx(stack))).toEqual(
			new Set([
				"runtime:stacked",
			]),
		);

		const producerLane = {
			kind: "delivery-batch",
			actorId: "runtime:producer",
			batchKey: "7:runtime:producer",
		};
		expect(Effect.runSync(readTileMotionLaneClaimsFx(spawn))).toContainEqual(producerLane);
		expect(Effect.runSync(readTileMotionLaneClaimsFx(stack))).toContainEqual(producerLane);
	});

	it("sums unsettled stack payloads by exact target", () => {
		const cues: ReadonlyArray<TileMotionCue> = [
			stackCue({
				eventIndex: 0,
				quantity: 1,
				targetActorId: "runtime:first",
			}),
			stackCue({
				eventIndex: 1,
				quantity: 3,
				targetActorId: "runtime:first",
			}),
			stackCue({
				eventIndex: 2,
				quantity: 2,
				targetActorId: "runtime:second",
			}),
		];

		expect(
			Effect.runSync(
				readUnsettledTileStackQuantitiesFx({
					cues,
				}),
			),
		).toEqual(
			new Map([
				[
					"runtime:first",
					4,
				],
				[
					"runtime:second",
					2,
				],
			]),
		);
	});
});
