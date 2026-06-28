import { describe, expect, it } from "vitest";
import { readTileEngineSlotVisibleFeedback } from "~/v0/tile-engine/readTileEngineSlotVisibleFeedback";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

const feedback = {
	dropId: "slot:target",
	effect: "merge",
	targetTileId: "tile:target",
} satisfies TileEngine.ActiveDropFeedback;

describe("readTileEngineSlotVisibleFeedback", () => {
	it("keeps empty slot feedback visible", () => {
		expect(
			readTileEngineSlotVisibleFeedback({
				dropFeedback: feedback,
				targetTile: undefined,
			}),
		).toBe(feedback);
	});

	it("hides slot chrome when an occupied target tile owns the feedback", () => {
		expect(
			readTileEngineSlotVisibleFeedback({
				dropFeedback: feedback,
				targetTile: {
					data: {},
					id: "tile:target",
					slotId: "slot:target",
				},
			}),
		).toBeNull();
	});
});
