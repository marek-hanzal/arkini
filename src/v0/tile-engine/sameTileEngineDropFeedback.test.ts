import { describe, expect, test } from "vitest";
import { sameTileEngineDropFeedback } from "~/tile-engine/sameTileEngineDropFeedback";

const baseFeedback = {
	dropId: "drop:1",
	effect: "merge" as const,
	variant: "primary" as const,
	targetTileId: "tile:1",
};

describe("sameTileEngineDropFeedback", () => {
	test("treats matching active drop feedback as equal", () => {
		expect(
			sameTileEngineDropFeedback(baseFeedback, {
				...baseFeedback,
			}),
		).toBe(true);
	});

	test("treats two empty feedback values as equal", () => {
		expect(sameTileEngineDropFeedback(null, undefined)).toBe(true);
	});

	test("detects changed visual fields", () => {
		expect(
			sameTileEngineDropFeedback(baseFeedback, {
				...baseFeedback,
				variant: "danger",
			}),
		).toBe(false);
	});

	test("detects changed target tile", () => {
		expect(
			sameTileEngineDropFeedback(baseFeedback, {
				...baseFeedback,
				targetTileId: "tile:2",
			}),
		).toBe(false);
	});
});
