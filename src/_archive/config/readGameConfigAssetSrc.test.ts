import { describe, expect, it } from "vitest";
import type { GameConfig } from "~/config/GameConfigTypes";
import { readGameConfigAssetSrc, readGameResourceSrc } from "~/config/readGameConfigAssetSrc";

const createConfig = (): GameConfig => ({
	version: 1,
	game: {
		board: {
			height: 1,
			width: 1,
		},
		id: "game:test",
		inventory: {
			slots: 1,
		},
		title: "Test",
	},
	resources: {
		"resource:hero": {
			data: "hero-base64",
		},
	},
	assets: {
		"asset:game:hero": {
			render: "plain",
			resourceId: "resource:hero",
		},
	},
	items: {},
	startingState: {
		board: [],
		inventory: [],
	},
});

describe("readGameResourceSrc", () => {
	it("wraps raw base64 PNG resources as image data URLs", () => {
		expect(readGameResourceSrc("hero-base64")).toBe("data:image/png;base64,hero-base64");
	});

	it("keeps already-addressable resource URLs untouched", () => {
		expect(readGameResourceSrc("data:image/png;base64,hero-base64")).toBe(
			"data:image/png;base64,hero-base64",
		);
	});
});

describe("readGameConfigAssetSrc", () => {
	it("resolves a configured asset through its packaged resource", () => {
		expect(
			readGameConfigAssetSrc({
				assetId: "asset:game:hero",
				config: createConfig(),
			}),
		).toBe("data:image/png;base64,hero-base64");
	});

	it("returns undefined for missing game assets", () => {
		expect(
			readGameConfigAssetSrc({
				assetId: "asset:missing",
				config: createConfig(),
			}),
		).toBeUndefined();
	});
});
