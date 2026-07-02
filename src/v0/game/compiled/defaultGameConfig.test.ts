import { describe, expect, it } from "vitest";
import { defaultGameConfig } from "~/v0/game/compiled/defaultGameConfig";

describe("defaultGameConfig", () => {
	it("is compiled to the output-owned producer effect model without legacy mutator fields", () => {
		expect(JSON.stringify(defaultGameConfig)).not.toContain("grantSelector");
		expect(JSON.stringify(defaultGameConfig.effects)).not.toContain("operations");
	});

	it("keeps passive effects as global grant sources", () => {
		expect(defaultGameConfig.effects["effect:shrine-minor-haste"]).toMatchObject({
			grants: [
				{
					id: "grant:active:shrine-minor-haste",
					name: "Minor Haste active",
				},
			],
		});
	});

	it("authors work requirements directly on product outputs", () => {
		const output = defaultGameConfig.products["product:lumberjack-t1:log"]?.output?.[0];

		expect(output && "effects" in output ? output.effects?.[2] : undefined).toMatchObject({
			display: "always",
			kind: "nearby.require",
			phase: "start",
		});
	});
	it("caps every producer building item", () => {
		const producerItemIds = Object.keys(defaultGameConfig.items)
			.filter((itemId) => itemId.startsWith("producer:"))
			.sort();
		const uncappedProducerItemIds = producerItemIds.filter(
			(itemId) => defaultGameConfig.items[itemId]?.maxCount === undefined,
		);

		expect(uncappedProducerItemIds).toEqual([]);
	});

	it("marks single-copy producer buildings as unique metadata", () => {
		const singleCopyProducerItemIds = Object.keys(defaultGameConfig.items)
			.filter((itemId) => itemId.startsWith("producer:"))
			.filter((itemId) => defaultGameConfig.items[itemId]?.maxCount === 1)
			.sort();

		expect(singleCopyProducerItemIds).toEqual(
			expect.arrayContaining([
				"producer:townhall-t1",
				"producer:library-t1",
				"producer:school",
				"producer:cathedral",
			]),
		);

		for (const itemId of singleCopyProducerItemIds) {
			expect(defaultGameConfig.items[itemId]?.tags).toContain("unique");
		}
	});
	it("makes town hall upgrade planning a real timed milestone", () => {
		const townHallUpgradePlanDurations = {
			"product:townhall-t1:blueprint-townhall-t2": 60000,
			"product:townhall-t2:blueprint-townhall-t3": 90000,
			"product:townhall-t3:blueprint-townhall-t4": 120000,
		} as const;

		for (const [productId, durationMs] of Object.entries(townHallUpgradePlanDurations)) {
			const product = defaultGameConfig.products[productId];

			expect(product?.durationMs).toBe(durationMs);
			expect(product?.tags).toContain("shrine:haste-target");
			const output = product?.output?.[0];
			expect(output && "effects" in output ? output.effects : undefined).toContainEqual(
				expect.objectContaining({
					display: "whenActive",
					kind: "grant.duration.multiply",
					label: "Minor Haste",
					multiplier: 0.75,
				}),
			);
		}
	});

	it("does not ship placeholder one-second gameplay timings", () => {
		const oneSecondProductIds = Object.entries(defaultGameConfig.products)
			.filter(([, product]) => product.durationMs === 1000)
			.map(([productId]) => productId)
			.sort();
		const oneSecondCraftIds = Object.entries(defaultGameConfig.craftRecipes)
			.filter(([, craftRecipe]) => craftRecipe.durationMs === 1000)
			.map(([craftRecipeId]) => craftRecipeId)
			.sort();

		expect(oneSecondProductIds).toEqual([]);
		expect(oneSecondCraftIds).toEqual([]);
	});
	it("keeps blueprint planning costs separate from construction costs", () => {
		const repeatedBlueprintCosts = Object.entries(defaultGameConfig.products)
			.flatMap(([productId, product]) =>
				(product.output ?? []).flatMap((output) => {
					if (!("itemId" in output)) return [];
					const blueprintItemId = output.itemId;
					if (!blueprintItemId.includes(":blueprint-")) return [];
					const craftRecipe = defaultGameConfig.craftRecipes[blueprintItemId];
					if (craftRecipe === undefined) return [];

					const productInputItemIds = new Set(
						(product.inputs ?? []).map((input) => input.itemId),
					);
					return craftRecipe.inputs
						.map((input) => input.itemId)
						.filter((itemId) => productInputItemIds.has(itemId))
						.map((itemId) => `${productId} repeats ${itemId}`);
				}),
			)
			.sort();

		expect(repeatedBlueprintCosts).toEqual([]);
	});

	it("keeps feasts as construction labor cost instead of town hall plan cost", () => {
		expect(
			defaultGameConfig.products["product:townhall-t3:blueprint-townhall-t4"]?.inputs?.map(
				(input) => input.itemId,
			),
		).not.toContain("item:feast");
		expect(
			defaultGameConfig.craftRecipes["item:blueprint-townhall-t4"]?.inputs.map(
				(input) => input.itemId,
			),
		).toContain("item:feast");
	});
});
