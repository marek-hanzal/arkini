import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import { readPixiTileQuantityPresentationFx } from "~/ui/pixi/motion/readPixiTileQuantityPresentationFx";

import { inputCue, stackCue } from "./readPixiTileQuantityPresentationFx.test/fixture";

const read = (
	cues: ReadonlyArray<TileMotionCue>,
	revealedInputCueKeys: ReadonlySet<string> = new Set(),
) =>
	Effect.runSync(
		readPixiTileQuantityPresentationFx({
			cues,
			readTargetRoute: (actorId, location) => ({
				actorId,
				location,
				redirected: false,
			}),
			revealedInputCueKeys,
		}),
	);

describe("readPixiTileQuantityPresentationFx", () => {
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
