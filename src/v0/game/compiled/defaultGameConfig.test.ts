import { describe, expect, it } from "vitest";
import { defaultGameConfig } from "~/v0/game/compiled/defaultGameConfig";

const readItemResourceData = (itemId: string) => {
	const item = defaultGameConfig.items[itemId];
	if (!item) throw new Error(`Missing item ${itemId}`);

	const asset = defaultGameConfig.assets[item.assetId];
	if (!asset) throw new Error(`Missing asset ${item.assetId}`);

	return defaultGameConfig.resources[asset.resourceId]?.data;
};

describe("defaultGameConfig", () => {
	it("uses compiled resource data for default item assets", () => {
		expect(readItemResourceData("item:tree")).toMatch(/^iVBOR/);
		expect(readItemResourceData("item:rock")).toMatch(/^iVBOR/);
		expect(readItemResourceData("producer:sawmill-t1")).toMatch(/^iVBOR/);
		expect(readItemResourceData("producer:stonemason-t1")).toMatch(/^iVBOR/);
	});

	const expectPassiveOwnedRequirements = (
		craftRecipeId: string,
		expectedItemIds: readonly string[],
	) => {
		const recipe = defaultGameConfig.craftRecipes[craftRecipeId];
		if (!recipe) throw new Error(`Missing craft recipe ${craftRecipeId}`);

		expect(recipe.requirements).toEqual(
			expectedItemIds.map((itemId) => ({
				itemId,
				quantity: 1,
				scope: "board_or_inventory",
				type: "passive",
			})),
		);
	};

	it("requires complete era ownership before townhall tier progression", () => {
		expectPassiveOwnedRequirements("craft:townhall-t2", [
			"producer:lumberjack-t1",
			"producer:sawmill-t1",
			"producer:quarry-t1",
			"producer:stonemason-t1",
			"producer:well-t1",
		]);

		expectPassiveOwnedRequirements("craft:townhall-t3", [
			"producer:windmill-t1",
			"producer:bakery-t1",
			"producer:pig-farm-t1",
			"producer:slaughterhouse-t1",
			"item:hop-field",
			"producer:brewery-t1",
			"producer:tavern-t1",
			"item:vineyard",
			"producer:winery-t1",
		]);

		expectPassiveOwnedRequirements("craft:townhall-t4", [
			"item:coal-deposit",
			"producer:coal-mine-t1",
			"item:iron-deposit",
			"producer:iron-mine-t1",
			"producer:smelter-t1",
			"producer:purifier-t1",
			"item:gold-deposit",
			"producer:gold-mine-t1",
		]);
	});
});
