import { describe, expect, it } from "vitest";

import type { TileMotionCue } from "~/ui/pixi/motion/TileMotionCue";
import { readQuantityPresentationFn } from "~/ui/pixi/motion/fn/readQuantityPresentationFn";

import { inputCue, stackCue } from "./readQuantityPresentationFn.test/fixture";

const read = (
	cues: ReadonlyArray<TileMotionCue>,
	revealedInputCueKeys: ReadonlySet<string> = new Set(),
) =>
	readQuantityPresentationFn({
		cues,
		resolvedTargetActorIdByCueKey: new Map(),
		revealedInputCueKeys,
	});

describe("readQuantityPresentationFn", () => {
	it("does not reveal an older stack through a later input epoch", () => {
		expect(
			read([
				stackCue,
				inputCue,
			]).get("runtime:item"),
		).toEqual({
			kind: "exact",
			quantity: 5,
		});
		expect(
			read([
				inputCue,
			]).get("runtime:item"),
		).toEqual({
			kind: "exact",
			quantity: 6,
		});
		expect(
			read(
				[
					inputCue,
				],
				new Set([
					"2:0",
				]),
			).get("runtime:item"),
		).toEqual({
			kind: "exact",
			quantity: 4,
		});
	});
});
