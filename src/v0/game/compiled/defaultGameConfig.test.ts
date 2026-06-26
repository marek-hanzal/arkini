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

	it("wires era IV civic progression through permits and Market II", () => {
		expect(defaultGameConfig.producers["producer:townhall-t4"].productIds).toEqual([
			"product:townhall-t4:blueprint-paper-mill-t1",
			"product:townhall-t4:blueprint-school",
			"product:townhall-t4:blueprint-civic-office-t1",
			"product:townhall-t4:blueprint-market-t2",
			"product:townhall-t4:blueprint-prospector-guild-t1",
			"product:townhall-t4:blueprint-tannery-t1",
			"product:townhall-t4:blueprint-weaver-hut-t1",
			"product:townhall-t4:blueprint-dye-workshop-t1",
			"product:townhall-t4:blueprint-tailor-workshop-t1",
		]);

		expect(defaultGameConfig.producers["producer:civic-office-t1"].productIds).toEqual([
			"product:civic-office-t1:building-permit",
			"product:civic-office-t1:blueprint-academy",
		]);

		expect(defaultGameConfig.items["item:building-permit"].tags).toContain("master");
		expect(defaultGameConfig.items["item:building-permit"].tags).toContain("era:IV");

		expect(defaultGameConfig.craftRecipes["craft:market-t2"].inputs).toContainEqual({
			consume: true,
			itemId: "producer:market-t1",
			quantity: 1,
		});
	});

	it("wires era V textile and clothing progression", () => {
		expect(defaultGameConfig.producers["producer:slaughterhouse-t1"].productIds).toEqual([
			"product:slaughterhouse-t1:sausage-raw-hide",
		]);

		expect(
			defaultGameConfig.lootTables["loot:slaughterhouse-t1:sausage-raw-hide"].output,
		).toContainEqual({
			itemId: "item:raw-hide",
			quantity: 1,
			type: "guaranteed",
		});

		expect(defaultGameConfig.items["item:luxury-clothing"].tags).toContain("master");
		expect(defaultGameConfig.items["item:luxury-clothing"].tags).toContain("era:V");

		expect(defaultGameConfig.producers["producer:tailor-workshop-t1"].productIds).toEqual([
			"product:tailor-workshop-t1:common-clothing",
			"product:tailor-workshop-t1:luxury-clothing",
		]);
	});

	it("wires era VII mining expansion through Academy and Prospector Guild 2", () => {
		expect(defaultGameConfig.items["item:advanced-knowledge"].tags).toContain("era:VII");
		expect(defaultGameConfig.items["item:advanced-knowledge"].tags).not.toContain("master");
		expect(defaultGameConfig.items["item:gold-ore"].tags).toContain("master");
		expect(defaultGameConfig.items["item:gold-ore"].tags).toContain("era:VII");

		expect(defaultGameConfig.producers["producer:academy"].productIds.slice(0, 6)).toEqual([
			"product:academy:basic-knowledge",
			"product:academy:advanced-knowledge",
			"product:academy:blueprint-prospector-guild-t2",
			"product:academy:blueprint-coal-mine-t1",
			"product:academy:blueprint-iron-mine-t1",
			"product:academy:blueprint-gold-mine-t1",
		]);

		expect(defaultGameConfig.items["producer:prospector-guild-t1"].label).toBe("1");
		expect(defaultGameConfig.items["producer:prospector-guild-t2"].label).toBe("2");

		expect(defaultGameConfig.producers["producer:prospector-guild-t1"].productIds).toEqual([
			"product:prospector-guild-t1:clay-deposit",
			"product:prospector-guild-t1:sand-deposit",
		]);

		expect(defaultGameConfig.producers["producer:prospector-guild-t2"].productIds).toEqual([
			"product:prospector-guild-t2:clay-deposit",
			"product:prospector-guild-t2:sand-deposit",
			"product:prospector-guild-t2:coal-deposit",
			"product:prospector-guild-t2:iron-deposit",
			"product:prospector-guild-t2:gold-deposit",
		]);

		expect(defaultGameConfig.craftRecipes["craft:coal-mine-t1"].inputs).not.toContainEqual({
			consume: true,
			itemId: "item:construction-bundle",
			quantity: 1,
		});
	});

	it("wires era VIII dirty processing behind Purifier and pollution side outputs", () => {
		expect(defaultGameConfig.items["item:construction-bundle"].tags).toContain("master");
		expect(defaultGameConfig.items["item:construction-bundle"].tags).toContain("era:VIII");

		expect(defaultGameConfig.producers["producer:construction-yard-t1"].productIds).toEqual([
			"product:construction-yard-t1:construction-bundle",
		]);

		expect(defaultGameConfig.producers["producer:academy"].productIds).toContain(
			"product:academy:blueprint-purifier-t1",
		);
		expect(defaultGameConfig.producers["producer:academy"].productIds).toContain(
			"product:academy:blueprint-smelter-t1",
		);

		expect(defaultGameConfig.producers["producer:charcoal-burner-t1"].productIds).toEqual([
			"product:charcoal-burner-t1:charcoal",
		]);
		expect(defaultGameConfig.producers["producer:clay-pit"].requirementIds).toEqual([
			"proximity:clay-pit:clay-deposit",
		]);
		expect(defaultGameConfig.producers["producer:sand-pit"].requirementIds).toEqual([
			"proximity:sand-pit:sand-deposit",
		]);

		expect(
			defaultGameConfig.products["product:charcoal-burner-t1:charcoal"].requirementIds,
		).toEqual([
			"proximity:dirty-processing:purifier",
		]);
		expect(defaultGameConfig.products["product:smelter-t1:iron-ingot"].requirementIds).toEqual([
			"proximity:dirty-processing:purifier",
		]);

		expect(defaultGameConfig.inputs["input:purifier-t1:pollution"].inputs).toEqual([
			{
				capacity: 4,
				consume: true,
				itemId: "item:pollution",
				quantity: 1,
			},
			{
				capacity: 4,
				consume: true,
				itemId: "item:water",
				quantity: 1,
			},
			{
				capacity: 4,
				consume: true,
				itemId: "item:charcoal",
				quantity: 1,
			},
		]);

		expect(defaultGameConfig.lootTables["loot:smelter-t1:iron-ingot"].output).toContainEqual({
			chance: 0.75,
			itemId: "item:pollution",
			quantity: 1,
			type: "chance",
		});
		expect(
			defaultGameConfig.lootTables["loot:construction-yard-t1:construction-bundle"].output,
		).toContainEqual({
			itemId: "item:construction-bundle",
			quantity: 1,
			type: "guaranteed",
		});
	});

	it("requires complete era ownership before townhall tier progression", () => {
		expectPassiveOwnedRequirements("craft:townhall-t2", [
			"producer:lumberjack-t1",
			"producer:sawmill-t1",
			"producer:quarry-t1",
			"producer:stonemason-t1",
			"producer:well-t1",
		]);

		expectPassiveOwnedRequirements("craft:townhall-t3", [
			"item:wheat-field",
			"producer:farm-t1",
			"producer:pig-farm-t1",
			"producer:cattle-farm-t1",
			"producer:chicken-coop-t1",
			"producer:sheep-pasture-t1",
			"producer:vegetable-garden-t1",
		]);

		expectPassiveOwnedRequirements("craft:townhall-t4", [
			"producer:windmill-t1",
			"producer:bakery-t1",
			"producer:slaughterhouse-t1",
			"producer:dairy-t1",
			"producer:cookhouse-t1",
			"item:hop-field",
			"producer:brewery-t1",
			"producer:tavern-t1",
			"item:vineyard",
			"producer:winery-t1",
			"producer:market-t1",
		]);
	});
});
