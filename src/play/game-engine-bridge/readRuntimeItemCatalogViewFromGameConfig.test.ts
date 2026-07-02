import { describe, expect, it } from "vitest";
import { createEngineMergeTestConfig } from "~/engine/test/createEngineMergeTestConfig";
import { readRuntimeItemCatalogViewFromGameConfig } from "~/play/game-engine-bridge/readRuntimeItemCatalogViewFromGameConfig";

const config = createEngineMergeTestConfig();

describe("readRuntimeItemCatalogViewFromGameConfig", () => {
	it("does not expose forward usage relation lists in item detail catalog data", () => {
		const catalog = readRuntimeItemCatalogViewFromGameConfig(config);
		const water = catalog["item:water"] as Record<string, unknown>;

		expect(water).not.toHaveProperty("mergeResults");
		expect(water).not.toHaveProperty("usedInMerges");
		expect(water).not.toHaveProperty("usedInCrafts");
	});
	it("exposes ordered resolved asset views from item asset ids", () => {
		const catalog = readRuntimeItemCatalogViewFromGameConfig({
			...config,
			resources: {
				...config.resources,
				"resource:late": {
					data: "late-bytes",
				},
			},
			assets: {
				...config.assets,
				"asset:late": {
					resourceId: "resource:late",
					render: "plain",
				},
			},
			items: {
				...config.items,
				"item:water": {
					...config.items["item:water"],
					assetIds: [
						"asset:test",
						"asset:late",
					],
				},
			},
		});

		expect(catalog["item:water"]?.assets.map((asset) => asset.src)).toEqual([
			"data:image/png;base64,x",
			"data:image/png;base64,late-bytes",
		]);
	});
});
