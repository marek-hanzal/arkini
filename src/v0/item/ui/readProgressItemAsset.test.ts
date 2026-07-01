import { describe, expect, it } from "vitest";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import { readProgressItemAsset } from "~/v0/item/ui/readProgressItemAsset";

const item: ViewItem = {
	assets: [
		{
			src: "asset-0.png",
		},
		{
			src: "asset-1.png",
		},
	],
	description: "Test item.",
	generatedEffects: [],
	id: "item:test",
	maxStackSize: 1,
	name: "Test",
	storage: "both",
	tags: [],
};

describe("readProgressItemAsset", () => {
	it("maps two assets to 0-49% and 50-100% input progress windows", () => {
		expect(
			readProgressItemAsset({
				item,
				progress: 0,
			}).src,
		).toBe("asset-0.png");
		expect(
			readProgressItemAsset({
				item,
				progress: 0.49,
			}).src,
		).toBe("asset-0.png");
		expect(
			readProgressItemAsset({
				item,
				progress: 0.5,
			}).src,
		).toBe("asset-1.png");
		expect(
			readProgressItemAsset({
				item,
				progress: 1,
			}).src,
		).toBe("asset-1.png");
	});

	it("clamps out-of-range progress", () => {
		expect(
			readProgressItemAsset({
				item,
				progress: -1,
			}).src,
		).toBe("asset-0.png");
		expect(
			readProgressItemAsset({
				item,
				progress: 2,
			}).src,
		).toBe("asset-1.png");
	});
});
