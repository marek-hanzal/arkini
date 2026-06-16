import { describe, expect, it } from "vitest";
import { GameConfig } from "~/v0/manifest/GameConfig";
import { assertGameConfig } from "~/v0/manifest/validation/gameConfig";

type AssertableGameConfig = Parameters<typeof assertGameConfig>[0];

const mutableGameConfig = () => structuredClone(GameConfig) as typeof GameConfig;

const minimalGameConfig = () =>
	({
		game: GameConfig.game,
		assets: [
			{
				id: "asset:item-twig",
				kind: "item",
				label: "Twig",
				src: "/item-twig.svg",
				sort: 10,
			},
			{
				id: "asset:item-branch",
				kind: "item",
				label: "Branch",
				src: "/item-branch.svg",
				sort: 20,
			},
			{
				id: "asset:item-lumber-camp",
				kind: "item",
				label: "Lumber Camp",
				src: "/item-lumber-camp.svg",
				sort: 30,
			},
			{
				id: "asset:item-coin-stack",
				kind: "item",
				label: "Coin Stack",
				src: "/item-coin-stack.svg",
				sort: 40,
			},
		],
		resources: [],
		lootTables: [
			{
				id: "loot:lumber-camp-1",
				name: "Lumber Camp I",
				output: [
					{
						type: "guaranteed",
						itemId: "item:twig",
						quantity: 1,
					},
				],
			},
		],
		upgrades: [
			{
				id: "upgrade:lumber-camp-1-speed",
				code: "lumber-camp-1-speed",
				name: "Lumber Camp I Speed",
				description: "A tiny test upgrade.",
				sort: 10,
				tiers: [
					{
						cost: [
							{
								itemId: "item:coin-stack",
								quantity: 1,
							},
						],
						durationMs: 0,
						effects: [
							{
								type: "producer.cooldown.add",
								itemId: "item:lumber-camp-1",
								ms: -100,
							},
						],
					},
				],
			},
		],
		items: [
			{
				id: "item:twig",
				assetId: "asset:item-twig",
				code: "twig",
				name: "Twig",
				tier: 1,
				maxStackSize: 99,
				description: "A test twig.",
				tags: [
					"natural",
				],
				sort: 10,
			},
			{
				id: "item:branch",
				assetId: "asset:item-branch",
				code: "branch",
				name: "Branch",
				tier: 2,
				maxStackSize: 99,
				description: "A test branch.",
				tags: [
					"natural",
				],
				sort: 20,
			},
			{
				id: "item:lumber-camp-1",
				assetId: "asset:item-lumber-camp",
				code: "lumber-camp-1",
				name: "Lumber Camp I",
				tier: 1,
				maxStackSize: 1,
				description: "A tiny test producer.",
				tags: [
					"producer",
				],
				sort: 30,
				producer: {
					type: "producer",
					trigger: "click",
					placement: "board_then_inventory",
					cooldownMs: 1000,
					outputTableId: "loot:lumber-camp-1",
				},
			},
			{
				id: "item:coin-stack",
				assetId: "asset:item-coin-stack",
				code: "coin-stack",
				name: "Coin Stack",
				tier: 1,
				maxStackSize: 99,
				description: "A tiny test currency pile.",
				tags: [
					"currency",
				],
				sort: 40,
			},
		],
		startingState: {
			resources: [],
			inventory: [],
			board: [],
		},
	}) satisfies GameConfig.Shape;

const assertManifest = (config: GameConfig.Shape) => {
	assertGameConfig(config as unknown as AssertableGameConfig);
};

const findItem = (config: GameConfig.Shape, itemId: string) => {
	const item = config.items.find((candidate) => candidate.id === itemId);
	expect(item).toBeDefined();
	return item!;
};

const findUpgrade = (config: GameConfig.Shape, upgradeId: string) => {
	const upgrade = config.upgrades.find((candidate) => candidate.id === upgradeId);
	expect(upgrade).toBeDefined();
	return upgrade!;
};

describe("assertGameConfig", () => {
	it("accepts the shipped manifest before the game gets ideas", () => {
		expect(() => assertGameConfig(GameConfig)).not.toThrow();
	});

	it("accepts a small focused fixture before invalid-reference tests", () => {
		expect(() => assertManifest(minimalGameConfig())).not.toThrow();
	});

	it("rejects duplicate item ids", () => {
		const config = mutableGameConfig();
		const original = config.items[0];
		expect(original).toBeDefined();
		config.items.push({
			...original!,
			code: `${original!.code}-duplicate`,
		});

		expect(() => assertGameConfig(config)).toThrow(/Duplicate item/);
	});

	it("rejects items that point at a missing asset", () => {
		const config = minimalGameConfig();
		config.assets = config.assets.filter((asset) => asset.id !== "asset:item-twig");

		expect(() => assertManifest(config)).toThrow(
			/item:twig references missing asset asset:item-twig/,
		);
	});

	it("rejects producers that point at a missing loot table", () => {
		const config = minimalGameConfig();
		config.lootTables = config.lootTables.filter((table) => table.id !== "loot:lumber-camp-1");

		expect(() => assertManifest(config)).toThrow(
			/item:lumber-camp-1 producer references missing loot table loot:lumber-camp-1/,
		);
	});

	it("rejects activation inputs that point at an item removed from the manifest", () => {
		const config = minimalGameConfig();
		const producer = findItem(config, "item:lumber-camp-1").producer;
		expect(producer).toBeDefined();
		producer!.inputs = [
			{
				itemId: "item:branch",
				quantity: 1,
				capacity: 1,
			},
		];
		config.items = config.items.filter((item) => item.id !== "item:branch");

		expect(() => assertManifest(config)).toThrow(
			/item:lumber-camp-1 input references missing item item:branch/,
		);
	});

	it("rejects activation requirements that point at an item removed from the manifest", () => {
		const config = minimalGameConfig();
		const producer = findItem(config, "item:lumber-camp-1").producer;
		expect(producer).toBeDefined();
		producer!.requirements = [
			{
				itemId: "item:branch",
				quantity: 1,
				capacity: 1,
			},
		];
		config.items = config.items.filter((item) => item.id !== "item:branch");

		expect(() => assertManifest(config)).toThrow(
			/item:lumber-camp-1 requirement references missing item item:branch/,
		);
	});

	it("rejects craft recipes that point at missing inputs", () => {
		const config = minimalGameConfig();
		const crafter = findItem(config, "item:lumber-camp-1");
		crafter.craft = {
			id: "craft:lumber-camp",
			resultItemId: "item:twig",
			durationMs: 0,
			inputs: [
				{
					itemId: "item:branch",
					quantity: 1,
				},
			],
		};
		config.items = config.items.filter((item) => item.id !== "item:branch");

		expect(() => assertManifest(config)).toThrow(
			/craft:lumber-camp references missing craft input item:branch/,
		);
	});

	it("rejects upgrade costs that point at missing items", () => {
		const config = minimalGameConfig();
		const upgrade = findUpgrade(config, "upgrade:lumber-camp-1-speed");
		const firstTier = upgrade.tiers[0];
		expect(firstTier).toBeDefined();
		firstTier!.cost = [
			{
				itemId: "item:branch",
				quantity: 1,
			},
		];
		config.items = config.items.filter((item) => item.id !== "item:branch");

		expect(() => assertManifest(config)).toThrow(
			/upgrade:lumber-camp-1-speed cost references missing item item:branch/,
		);
	});

	it("rejects upgrade effects that point at missing items", () => {
		const config = minimalGameConfig();
		const upgrade = findUpgrade(config, "upgrade:lumber-camp-1-speed");
		const firstTier = upgrade.tiers[0];
		expect(firstTier).toBeDefined();
		firstTier!.effects = [
			{
				type: "producer.cooldown.add",
				itemId: "item:branch",
				ms: -100,
			},
		];
		config.items = config.items.filter((item) => item.id !== "item:branch");

		expect(() => assertManifest(config)).toThrow(
			/upgrade:lumber-camp-1-speed cooldown effect references missing item item:branch/,
		);
	});

	it("rejects upgrade effects that point at missing loot tables", () => {
		const config = minimalGameConfig();
		const upgrade = findUpgrade(config, "upgrade:lumber-camp-1-speed");
		const firstTier = upgrade.tiers[0];
		expect(firstTier).toBeDefined();
		firstTier!.effects = [
			{
				type: "producer.outputTable.set",
				itemId: "item:lumber-camp-1",
				tableId: "loot:lumber-camp-1:better-1",
			},
		];

		expect(() => assertManifest(config)).toThrow(
			/upgrade:lumber-camp-1-speed loot effect references missing table loot:lumber-camp-1:better-1/,
		);
	});
});
