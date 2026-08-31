import { describe, expect, it } from "vitest";

import { tileMotionCueTestFixture } from "~test/tile-presentation/support/tileMotionCueTestFixture";
import { readCommittedTileSwapMotionCueFn } from "~/tile-presentation/fn/readCommittedTileSwapMotionCueFn";

const { runtime, source, sourceLocation, swappedRuntime, target, targetLocation } =
	tileMotionCueTestFixture;

const captured = {
	source: {
		id: source.id,
		revision: source.revision,
		location: sourceLocation,
	},
	target: {
		id: target.id,
		revision: target.revision,
		location: targetLocation,
	},
};

describe("readCommittedTileSwapMotionCueFn", () => {
	it("compiles only the exchanged target half of an exact committed swap", () => {
		expect(
			readCommittedTileSwapMotionCueFn({
				...captured,
				transition: {
					sequence: 9,
					previousRuntime: runtime,
					runtime: swappedRuntime,
					events: [],
				},
			}),
		).toEqual({
			kind: "swap",
			sequence: 9,
			eventIndex: 0,
			staggerIndex: 0,
			actorId: target.id,
			counterpartActorId: source.id,
			originActorId: target.id,
			originLocation: targetLocation,
			targetLocation: sourceLocation,
		});
	});

	it("rejects a stale captured identity instead of animating an unrelated commit", () => {
		expect(
			readCommittedTileSwapMotionCueFn({
				...captured,
				source: {
					...captured.source,
					revision: "revision:stale",
				},
				transition: {
					sequence: 9,
					previousRuntime: runtime,
					runtime: swappedRuntime,
					events: [],
				},
			}),
		).toBeNull();
	});

	it("rejects missing history, stale captured geometry, and a non-exchange", () => {
		expect(
			readCommittedTileSwapMotionCueFn({
				...captured,
				transition: {
					sequence: 10,
					previousRuntime: null,
					runtime: swappedRuntime,
					events: [],
				},
			}),
		).toBeNull();
		expect(
			readCommittedTileSwapMotionCueFn({
				...captured,
				source: {
					...captured.source,
					location: targetLocation,
				},
				transition: {
					sequence: 10,
					previousRuntime: runtime,
					runtime: swappedRuntime,
					events: [],
				},
			}),
		).toBeNull();
		expect(
			readCommittedTileSwapMotionCueFn({
				...captured,
				transition: {
					sequence: 10,
					previousRuntime: runtime,
					runtime,
					events: [],
				},
			}),
		).toBeNull();
	});
});
