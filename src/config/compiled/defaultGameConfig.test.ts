import { describe, expect, it } from "vitest";
import { loadGameConfigPackFromFile } from "~/config/pack/loadGameConfigPackFromFile";

const defaultGameConfig = await loadGameConfigPackFromFile("game/arkini.game.arkpack");

const readLine = (lineId: string) =>
	Object.values(defaultGameConfig.items)
		.flatMap((item) => [
			...(item.producer?.lines ?? []),
			...(item.stash
				? [
						item.stash.line,
					]
				: []),
		])
		.find((line) => line.id === lineId);

const readLines = () =>
	Object.values(defaultGameConfig.items).flatMap((item) => [
		...(item.producer?.lines ?? []),
		...(item.stash
			? [
					item.stash.line,
				]
			: []),
	]);

const readCraftRecipe = (recipeId: string) => defaultGameConfig.items[recipeId]?.craft;

const readCraftRecipes = () =>
	Object.entries(defaultGameConfig.items).flatMap(([itemId, item]) =>
		item.craft
			? ([
					[
						itemId,
						item.craft,
					],
				] as const)
			: [],
	);

const readEmbeddedEffects = () =>
	Object.values(defaultGameConfig.items).flatMap((item) => [
		...(item.effects ?? []),
		...(item.producer?.lines.flatMap((line) =>
			line.effect
				? [
						line.effect,
					]
				: [],
		) ?? []),
		...(item.stash?.line.effect
			? [
					item.stash.line.effect,
				]
			: []),
	]);

const readEmbeddedEffect = (effectId: string) =>
	readEmbeddedEffects().find((effect) => effect.id === effectId);

describe("defaultGameConfig", () => {
	it("keeps active effects as line-owned grant sources", () => {
		expect(readEmbeddedEffect("effect:shrine-minor-haste")).toMatchObject({
			grants: [
				{
					id: "grant:active:shrine-minor-haste",
					name: "Minor Haste active",
				},
			],
		});
	});

	it("authors work requirements directly on product outputs", () => {
		const output = readLine("line:lumberjack-t1:log")?.output?.[0];

		expect(output && "effects" in output ? output.effects?.[2] : undefined).toMatchObject({
			display: "always",
			kind: "nearby.require",
			phase: "start",
		});
	});
	it("keeps every producer building single-copy", () => {
		const producerItemIds = Object.keys(defaultGameConfig.items)
			.filter((itemId) => itemId.startsWith("producer:"))
			.sort();
		const nonSingleCopyProducerItemIds = producerItemIds.filter(
			(itemId) => defaultGameConfig.items[itemId]?.maxCount !== 1,
		);

		expect(nonSingleCopyProducerItemIds).toEqual([]);
	});

	it("marks producer buildings as unique metadata", () => {
		const producerItemIds = Object.keys(defaultGameConfig.items)
			.filter((itemId) => itemId.startsWith("producer:"))
			.sort();

		expect(producerItemIds).toEqual(
			expect.arrayContaining([
				"producer:townhall-t1",
				"producer:lumberjack-t1",
				"producer:quarry-t1",
				"producer:library-t1",
				"producer:school",
				"producer:cathedral",
			]),
		);

		for (const itemId of producerItemIds) {
			expect(defaultGameConfig.items[itemId]?.tags).toContain("unique");
		}
	});

	it("does not offer starter producer blueprints from Town Hall I", () => {
		const townHallLineIds = defaultGameConfig.items[
			"producer:townhall-t1"
		]?.producer?.lines.map((line) => line.id);

		expect(townHallLineIds).not.toContain("line:townhall-t1:blueprint-lumberjack-t1");
		expect(townHallLineIds).not.toContain("line:townhall-t1:blueprint-quarry-t1");
	});
	it("makes town hall upgrade planning a real timed milestone", () => {
		const townHallUpgradePlanDurations = {
			"line:townhall-t1:blueprint-townhall-t2": 60000,
			"line:townhall-t2:blueprint-townhall-t3": 90000,
			"line:townhall-t3:blueprint-townhall-t4": 120000,
		} as const;

		for (const [lineId, durationMs] of Object.entries(townHallUpgradePlanDurations)) {
			const product = readLine(lineId);

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

	it("grows forest seeds through craft input stages instead of merge-only saplings", () => {
		const seed = defaultGameConfig.items["item:seed"];
		const water = defaultGameConfig.items["item:water"];

		expect(defaultGameConfig.items["item:sapling"]).toBeUndefined();
		expect(seed?.assetIds).toEqual([
			"asset:item:seed",
			"asset:item:sapling",
		]);
		expect(seed?.craft).toMatchObject({
			durationMs: 30000,
			resultItemId: "item:tree",
			inputs: [
				{
					consume: true,
					itemId: "item:water",
					quantity: 6,
				},
			],
		});
		expect(water?.merges?.some((merge) => merge.withItemId === "item:seed")).toBe(false);
	});

	it("does not ship placeholder one-second gameplay timings", () => {
		const oneSecondLineIds = readLines()
			.map(
				(product) =>
					[
						product.id,
						product,
					] as const,
			)
			.filter(([, product]) => product.durationMs === 1000)
			.map(([lineId]) => lineId)
			.sort();
		const oneSecondCraftIds = readCraftRecipes()
			.filter(([, craftRecipe]) => craftRecipe.durationMs === 1000)
			.map(([craftRecipeId]) => craftRecipeId)
			.sort();

		expect(oneSecondLineIds).toEqual([]);
		expect(oneSecondCraftIds).toEqual([]);
	});
	it("keeps blueprint planning costs separate from construction costs", () => {
		const repeatedBlueprintCosts = readLines()
			.map(
				(product) =>
					[
						product.id,
						product,
					] as const,
			)
			.flatMap(([lineId, product]) =>
				(product.output ?? []).flatMap((output) => {
					if (!("itemId" in output)) return [];
					const blueprintItemId = output.itemId;
					if (!blueprintItemId.includes(":blueprint-")) return [];
					const craftRecipe = readCraftRecipe(blueprintItemId);
					if (craftRecipe === undefined) return [];

					const productInputItemIds = new Set(
						(product.inputs ?? []).map((input) => input.itemId),
					);
					return craftRecipe.inputs
						.map((input) => input.itemId)
						.filter((itemId) => productInputItemIds.has(itemId))
						.map((itemId) => `${lineId} repeats ${itemId}`);
				}),
			)
			.sort();

		expect(repeatedBlueprintCosts).toEqual([]);
	});

	it("keeps feasts as construction labor cost instead of town hall plan cost", () => {
		expect(
			readLine("line:townhall-t3:blueprint-townhall-t4")?.inputs?.map(
				(input) => input.itemId,
			),
		).not.toContain("item:feast");
		expect(
			readCraftRecipe("item:blueprint-townhall-t4")?.inputs.map((input) => input.itemId),
		).toContain("item:feast");
	});
});
