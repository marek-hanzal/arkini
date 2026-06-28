import { describe, expect, it } from "vitest";
import { createEngineMergeTestConfig } from "~/v0/game/engine/test/createEngineMergeTestConfig";
import { readRuntimeItemCatalogViewFromGameConfig } from "~/v0/play/game-engine-bridge/readRuntimeItemCatalogViewFromGameConfig";

const config = createEngineMergeTestConfig();

describe("readRuntimeItemCatalogViewFromGameConfig", () => {
	it("does not expose forward usage relation lists in item detail catalog data", () => {
		const catalog = readRuntimeItemCatalogViewFromGameConfig(config);
		const water = catalog["item:water"] as Record<string, unknown>;

		expect(water).not.toHaveProperty("mergeResults");
		expect(water).not.toHaveProperty("usedInMerges");
		expect(water).not.toHaveProperty("usedInCrafts");
	});
});
