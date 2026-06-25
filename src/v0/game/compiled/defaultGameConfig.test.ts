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
			"product:townhall-t4:blueprint-surveyor-camp-t1",
			"product:townhall-t4:blueprint-tannery-t1",
			"product:townhall-t4:blueprint-weaver-hut-t1",
			"product:townhall-t4:blueprint-dye-workshop-t1",
			"product:townhall-t4:blueprint-tailor-workshop-t1",
			"product:townhall-t4:blueprint-charcoal-burner-t1",
			"product:townhall-t4:blueprint-clay-pit",
			"product:townhall-t4:blueprint-sand-pit",
			"product:townhall-t4:blueprint-brickyard",
			"product:townhall-t4:blueprint-glassworks",
			"product:townhall-t4:blueprint-roof-tile-factory",
			"product:townhall-t4:blueprint-construction-yard-t1",
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

	it("wires era VI advanced construction progression", () => {
		expect(defaultGameConfig.items["item:construction-bundle"].tags).toContain("master");
		expect(defaultGameConfig.items["item:construction-bundle"].tags).toContain("era:VI");

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
			defaultGameConfig.lootTables["loot:construction-yard-t1:construction-bundle"].output,
		).toContainEqual({
			itemId: "item:construction-bundle",
			quantity: 1,
			type: "guaranteed",
		});
	});

	it("wires era VII industrial knowledge and metallurgy progression", () => {
		expect(defaultGameConfig.items["item:advanced-knowledge"].tags).toContain("master");
		expect(defaultGameConfig.items["item:advanced-knowledge"].tags).toContain("era:VII");

		expect(defaultGameConfig.producers["producer:construction-yard-t1"].productIds).toEqual([
			"product:construction-yard-t1:construction-bundle",
			"product:construction-yard-t1:blueprint-academy",
		]);

		expect(defaultGameConfig.producers["producer:academy"].productIds).toEqual([
			"product:academy:basic-knowledge",
			"product:academy:advanced-knowledge",
			"product:academy:blueprint-coal-mine-t1",
			"product:academy:blueprint-iron-mine-t1",
			"product:academy:blueprint-gold-mine-t1",
			"product:academy:blueprint-smelter-t1",
			"product:academy:blueprint-purifier-t1",
		]);

		expect(defaultGameConfig.producers["producer:surveyor-camp-t1"].productIds).toEqual([
			"product:surveyor-camp-t1:clay-deposit",
			"product:surveyor-camp-t1:sand-deposit",
			"product:surveyor-camp-t1:coal-deposit",
			"product:surveyor-camp-t1:iron-deposit",
			"product:surveyor-camp-t1:gold-deposit",
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
