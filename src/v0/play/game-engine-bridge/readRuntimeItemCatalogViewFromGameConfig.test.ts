import { describe, expect, it } from "vitest";
import { createEngineMergeTestConfig } from "~/v0/game/engine/test/createEngineMergeTestConfig";
import { readRuntimeItemCatalogViewFromGameConfig } from "~/v0/play/game-engine-bridge/readRuntimeItemCatalogViewFromGameConfig";

const config = createEngineMergeTestConfig();

describe("readRuntimeItemCatalogViewFromGameConfig", () => {
	it("surfaces only executable merge relations from the catalog", () => {
		const catalog = readRuntimeItemCatalogViewFromGameConfig(config);

		expect(catalog["item:water"]?.mergeResults).toContainEqual({
			resultItemId: "item:sprout",
			secret: true,
			withItemId: "item:twig",
		});
		expect(catalog["item:water"]?.usedInMerges ?? []).not.toContainEqual({
			resultItemId: "item:sprout",
			secret: true,
			targetItemId: "item:twig",
		});
	});

	it("keeps directed imprint relations one-way", () => {
		const catalog = readRuntimeItemCatalogViewFromGameConfig(config);

		expect(catalog["item:lumber-camp-1"]?.mergeResults).toContainEqual({
			resultItemId: "item:blueprint-lumber-camp",
			secret: true,
			withItemId: "item:blueprint",
		});
		expect(catalog["item:lumber-camp-1"]?.usedInMerges ?? []).not.toContainEqual({
			resultItemId: "item:blueprint-lumber-camp",
			secret: true,
			targetItemId: "item:blueprint",
		});
		expect(catalog["item:blueprint"]?.usedInMerges).toContainEqual({
			resultItemId: "item:blueprint-lumber-camp",
			secret: true,
			targetItemId: "item:lumber-camp-1",
		});
	});
});
