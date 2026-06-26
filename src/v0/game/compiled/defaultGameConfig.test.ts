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
			"product:townhall-t4:blueprint-house-t3",
		]);

		expect(defaultGameConfig.producers["producer:civic-office-t1"].productIds).toEqual([
			"product:civic-office-t1:building-permit",
			"product:civic-office-t1:building-permit-morale-t2",
			"product:civic-office-t1:blueprint-academy",
			"product:civic-office-t1:guild-charter",
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
		expect(defaultGameConfig.items["item:pigment"].tags).toContain("era:V");

		expect(defaultGameConfig.producers["producer:dye-workshop-t1"].productIds).toEqual([
			"product:dye-workshop-t1:pigment",
			"product:dye-workshop-t1:luxury-cloth",
		]);
		expect(
			defaultGameConfig.inputs["input:dye-workshop-t1:luxury-cloth"].inputs,
		).toContainEqual({
			capacity: 4,
			consume: true,
			itemId: "item:pigment",
			quantity: 1,
		});

		expect(defaultGameConfig.producers["producer:tailor-workshop-t1"].productIds).toEqual([
			"product:tailor-workshop-t1:common-clothing",
			"product:tailor-workshop-t1:luxury-clothing",
			"product:tailor-workshop-t1:luxury-clothing-morale-t3",
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
			"product:prospector-guild-t2:marble-deposit",
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
			"product:construction-yard-t1:construction-bundle-morale-t3",
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

	it("wires era IX guild institutions, equipment, keys, and expeditions", () => {
		expect(defaultGameConfig.items["item:guild-charter"].tags).toContain("era:IX");
		expect(defaultGameConfig.items["item:coin-stack"].tags).toContain("era:IX");
		expect(defaultGameConfig.items["item:treasure-chest"].tags).toContain("master");
		expect(defaultGameConfig.items["item:treasure-chest"].tags).toContain("era:IX");

		expect(defaultGameConfig.producers["producer:civic-office-t1"].productIds).toEqual([
			"product:civic-office-t1:building-permit",
			"product:civic-office-t1:building-permit-morale-t2",
			"product:civic-office-t1:blueprint-academy",
			"product:civic-office-t1:guild-charter",
		]);

		expect(defaultGameConfig.producers["producer:academy"].productIds).toContain(
			"product:academy:blueprint-blacksmith-t1",
		);
		expect(defaultGameConfig.producers["producer:academy"].productIds).toContain(
			"product:academy:blueprint-armory-t1",
		);
		expect(defaultGameConfig.producers["producer:academy"].productIds).toContain(
			"product:academy:blueprint-goldsmith-t1",
		);
		expect(defaultGameConfig.producers["producer:academy"].productIds).toContain(
			"product:academy:blueprint-university",
		);
		expect(defaultGameConfig.producers["producer:university"].productIds).toContain(
			"product:university:blueprint-heroes-guild-t1",
		);

		expect(defaultGameConfig.producers["producer:blacksmith-t1"].productIds).toEqual([
			"product:blacksmith-t1:nails",
			"product:blacksmith-t1:axe",
			"product:blacksmith-t1:sword",
		]);
		expect(defaultGameConfig.producers["producer:armory-t1"].productIds).toEqual([
			"product:armory-t1:leather-armor",
			"product:armory-t1:iron-armor",
		]);
		expect(defaultGameConfig.producers["producer:goldsmith-t1"].productIds).toEqual([
			"product:goldsmith-t1:coin-stack",
			"product:goldsmith-t1:key-t1",
			"product:goldsmith-t1:key-t2",
			"product:goldsmith-t1:key-t3",
			"product:goldsmith-t1:key-t4",
		]);
		expect(defaultGameConfig.producers["producer:heroes-guild-t1"].productIds).toEqual([
			"product:heroes-guild-t1:chest-t1",
			"product:heroes-guild-t1:chest-t2",
			"product:heroes-guild-t1:chest-t3",
			"product:heroes-guild-t1:chest-t4",
			"product:heroes-guild-t1:treasure-chest",
			"product:heroes-guild-t1:treasure-chest-morale-t4",
		]);

		expect(defaultGameConfig.products["product:blacksmith-t1:nails"].requirementIds).toEqual([
			"proximity:dirty-processing:purifier",
		]);
		expect(defaultGameConfig.products["product:armory-t1:iron-armor"].requirementIds).toEqual([
			"proximity:dirty-processing:purifier",
		]);
		expect(defaultGameConfig.products["product:goldsmith-t1:key-t4"].requirementIds).toEqual([
			"proximity:dirty-processing:purifier",
		]);

		expect(
			defaultGameConfig.inputs["input:heroes-guild-t1:treasure-chest"].inputs,
		).toContainEqual({
			capacity: 4,
			consume: true,
			itemId: "item:master-knowledge",
			quantity: 1,
		});
		expect(
			defaultGameConfig.inputs["input:heroes-guild-t1:treasure-chest"].inputs,
		).toContainEqual({
			capacity: 4,
			consume: true,
			itemId: "item:aquamarine",
			quantity: 1,
		});
		expect(
			defaultGameConfig.lootTables["loot:heroes-guild-t1:treasure-chest"].output,
		).toContainEqual({
			itemId: "item:treasure-chest",
			quantity: 1,
			type: "guaranteed",
		});
	});

	it("wires era X prestige glass materials through University and Glazier Workshop", () => {
		expect(defaultGameConfig.items["item:stained-glass"].tags).toContain("master");
		expect(defaultGameConfig.items["item:stained-glass"].tags).toContain("era:X");
		expect(defaultGameConfig.assets["asset:item:guild-charter"].resourceId).toBe(
			"item-guild-charter",
		);

		expect(defaultGameConfig.producers["producer:university"].productIds).toContain(
			"product:university:blueprint-glazier-workshop-t1",
		);
		expect(defaultGameConfig.producers["producer:glazier-workshop-t1"].productIds).toEqual([
			"product:glazier-workshop-t1:stained-glass",
			"product:glazier-workshop-t1:stained-glass-morale-t4",
		]);
		expect(defaultGameConfig.producers["producer:glazier-workshop-t1"].requirementIds).toEqual([
			"proximity:glazier-workshop-t1:glassworks",
		]);

		expect(
			defaultGameConfig.products["product:glazier-workshop-t1:stained-glass"].requirementIds,
		).toEqual([
			"proximity:dirty-processing:purifier",
		]);
		expect(
			defaultGameConfig.inputs["input:glazier-workshop-t1:stained-glass"].inputs,
		).toContainEqual({
			capacity: 4,
			consume: true,
			itemId: "item:pigment",
			quantity: 1,
		});
		expect(
			defaultGameConfig.lootTables["loot:glazier-workshop-t1:stained-glass"].output,
		).toContainEqual({
			chance: 0.5,
			itemId: "item:pollution",
			quantity: 1,
			type: "chance",
		});
		expect(
			defaultGameConfig.lootTables["loot:glazier-workshop-t1:stained-glass"].output,
		).toContainEqual({
			itemId: "item:stained-glass",
			quantity: 1,
			type: "guaranteed",
		});
	});

	it("wires era X marble prestige stone through Prospector, Quarry II, and Stonemason II", () => {
		expect(defaultGameConfig.items["item:marble-block"].tags).toContain("master");
		expect(defaultGameConfig.items["item:marble-block"].tags).toContain("era:X");
		expect(defaultGameConfig.assets["asset:item:marble-deposit"].resourceId).toBe(
			"item-marble-deposit",
		);
		expect(defaultGameConfig.assets["asset:producer:quarry-t2"].resourceId).toBe(
			"producer-quarry-t2",
		);

		expect(defaultGameConfig.producers["producer:prospector-guild-t2"].productIds).toContain(
			"product:prospector-guild-t2:marble-deposit",
		);
		expect(defaultGameConfig.producers["producer:university"].productIds).toContain(
			"product:university:blueprint-quarry-t2",
		);
		expect(defaultGameConfig.producers["producer:university"].productIds).toContain(
			"product:university:blueprint-stonemason-t2",
		);

		expect(defaultGameConfig.producers["producer:quarry-t2"].productIds).toEqual([
			"product:quarry-t2:stone",
			"product:quarry-t2:marble",
		]);
		expect(defaultGameConfig.producers["producer:quarry-t2"].requirementIds).toEqual([
			"proximity:quarry-t2:marble-deposit",
		]);
		expect(defaultGameConfig.producers["producer:stonemason-t2"].productIds).toEqual([
			"product:stonemason-t2:stone-block",
			"product:stonemason-t2:marble-block",
			"product:stonemason-t2:marble-block-morale-t4",
		]);
		expect(defaultGameConfig.producers["producer:stonemason-t2"].requirementIds).toEqual([
			"proximity:stonemason-t2:quarry-t2",
		]);

		expect(defaultGameConfig.craftRecipes["craft:quarry-t2"].inputs).toContainEqual({
			consume: true,
			itemId: "producer:quarry-t1",
			quantity: 1,
		});
		expect(defaultGameConfig.craftRecipes["craft:stonemason-t2"].inputs).toContainEqual({
			consume: true,
			itemId: "producer:stonemason-t1",
			quantity: 1,
		});
		expect(defaultGameConfig.inputs["input:stonemason-t2:marble-block"].inputs).toContainEqual({
			capacity: 4,
			consume: true,
			itemId: "item:marble",
			quantity: 1,
		});
		expect(
			defaultGameConfig.lootTables["loot:stonemason-t2:marble-block"].output,
		).toContainEqual({
			itemId: "item:marble-block",
			quantity: 1,
			type: "guaranteed",
		});
	});

	it("wires Choose The Path keystone buildings through University blueprints", () => {
		expect(defaultGameConfig.assets["asset:producer:house-of-engineers"].resourceId).toBe(
			"producer-house-of-engineers",
		);
		expect(defaultGameConfig.assets["asset:producer:cathedral"].resourceId).toBe(
			"producer-cathedral",
		);
		expect(defaultGameConfig.assets["asset:producer:mage-lodge"].resourceId).toBe(
			"producer-mage-lodge",
		);

		expect(defaultGameConfig.producers["producer:university"].productIds).toContain(
			"product:university:blueprint-house-of-engineers",
		);
		expect(defaultGameConfig.producers["producer:university"].productIds).toContain(
			"product:university:blueprint-cathedral",
		);
		expect(defaultGameConfig.producers["producer:university"].productIds).toContain(
			"product:university:blueprint-mage-lodge",
		);

		expect(defaultGameConfig.items["producer:house-of-engineers"].passiveEffectIds).toEqual([
			"effect:path-engineers-locks-counter-keystones",
		]);
		expect(defaultGameConfig.items["producer:cathedral"].passiveEffectIds).toEqual([
			"effect:path-faith-locks-counter-keystones",
		]);
		expect(defaultGameConfig.items["producer:mage-lodge"].passiveEffectIds).toEqual([
			"effect:path-mages-locks-counter-keystones",
		]);

		expect(
			defaultGameConfig.effects["effect:path-engineers-locks-counter-keystones"].operations,
		).toContainEqual({
			kind: "line.blockStart",
			reason: "Engineers path is already chosen.",
			target: {
				productIds: [
					"product:university:blueprint-cathedral",
					"product:university:blueprint-mage-lodge",
				],
			},
		});
		expect(
			defaultGameConfig.effects["effect:path-engineers-locks-counter-keystones"].operations,
		).toContainEqual({
			kind: "item.blockCreate",
			reason: "Engineers path is already chosen.",
			target: {
				itemIds: [
					"item:blueprint-cathedral",
					"item:blueprint-mage-lodge",
					"producer:cathedral",
					"producer:mage-lodge",
				],
			},
		});

		expect(
			defaultGameConfig.inputs["input:university:blueprint-house-of-engineers"].inputs,
		).toContainEqual({
			capacity: 2,
			consume: true,
			itemId: "item:treasure-chest",
			quantity: 1,
		});
		expect(
			defaultGameConfig.inputs["input:university:blueprint-cathedral"].inputs,
		).toContainEqual({
			capacity: 4,
			consume: true,
			itemId: "item:stained-glass",
			quantity: 2,
		});
		expect(
			defaultGameConfig.inputs["input:university:blueprint-mage-lodge"].inputs,
		).toContainEqual({
			capacity: 4,
			consume: true,
			itemId: "item:sapphire",
			quantity: 1,
		});

		expectPassiveOwnedRequirements("craft:house-of-engineers", [
			"producer:university",
			"producer:stonemason-t2",
			"producer:glazier-workshop-t1",
			"producer:blacksmith-t1",
		]);
		expectPassiveOwnedRequirements("craft:cathedral", [
			"producer:university",
			"producer:stonemason-t2",
			"producer:glazier-workshop-t1",
			"producer:civic-office-t1",
		]);
		expectPassiveOwnedRequirements("craft:mage-lodge", [
			"producer:university",
			"producer:stonemason-t2",
			"producer:glazier-workshop-t1",
			"producer:heroes-guild-t1",
		]);
	});

	it("wires housing morale as a side economy and optional production boost", () => {
		expect(defaultGameConfig.assets["asset:producer:house-t1"].resourceId).toBe(
			"producer-house-t1",
		);
		expect(defaultGameConfig.assets["asset:item:morale-t4"].resourceId).toBe("item-morale-t4");

		expect(defaultGameConfig.producers["producer:townhall-t2"].productIds).toContain(
			"product:townhall-t2:blueprint-house-t1",
		);
		expect(defaultGameConfig.producers["producer:townhall-t3"].productIds).toContain(
			"product:townhall-t3:blueprint-house-t2",
		);
		expect(defaultGameConfig.producers["producer:townhall-t4"].productIds).toContain(
			"product:townhall-t4:blueprint-house-t3",
		);
		expect(defaultGameConfig.producers["producer:university"].productIds).toContain(
			"product:university:blueprint-house-t4",
		);

		expect(defaultGameConfig.producers["producer:house-t1"].productIds).toEqual([
			"product:house-t1:morale-t1",
		]);
		expect(defaultGameConfig.lootTables["loot:house-t4:morale-t4"].output).toEqual([
			{
				itemId: "item:morale-t4",
				quantity: 1,
				type: "guaranteed",
			},
			{
				itemId: "item:morale-t3",
				quantity: 1,
				type: "guaranteed",
			},
			{
				itemId: "item:morale-t2",
				quantity: 1,
				type: "guaranteed",
			},
			{
				itemId: "item:morale-t1",
				quantity: 1,
				type: "guaranteed",
			},
		]);

		expect(defaultGameConfig.craftRecipes["craft:townhall-t3"].inputs).toContainEqual({
			consume: true,
			itemId: "item:morale-t1",
			quantity: 1,
		});
		expect(defaultGameConfig.craftRecipes["craft:townhall-t4"].inputs).toContainEqual({
			consume: true,
			itemId: "item:morale-t2",
			quantity: 1,
		});
		expect(defaultGameConfig.craftRecipes["craft:house-of-engineers"].inputs).toContainEqual({
			consume: true,
			itemId: "item:morale-t4",
			quantity: 1,
		});

		expect(defaultGameConfig.producers["producer:farm-t1"].productIds).toEqual([
			"product:farm-t1:grain",
			"product:farm-t1:grain-morale-t1",
		]);
		expect(defaultGameConfig.inputs["input:farm-t1:grain-morale-t1"].inputs).toContainEqual({
			capacity: 4,
			consume: true,
			itemId: "item:morale-t1",
			quantity: 1,
		});
		expect(defaultGameConfig.lootTables["loot:farm-t1:grain-morale-t1"].output).toEqual([
			{
				itemId: "item:grain",
				quantity: 2,
				type: "guaranteed",
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
