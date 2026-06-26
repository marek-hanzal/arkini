import { describe, expect, it } from "vitest";
import { parseGameConfig } from "~/v0/game/config/GameConfigSchema";

type TestActivationRequirement =
	| {
			capacity: number;
			itemId: string;
			quantity: number;
			type: "stored";
	  }
	| {
			itemId: string;
			quantity: number;
			scope: "board" | "inventory" | "board_or_inventory";
			type: "passive";
	  };

type TestGameRequirement =
	| TestActivationRequirement
	| {
			distance: number;
			durationFactor?: number;
			itemIds: string[];
			type: "proximity";
	  };

type TestGameHindrance =
	| {
			durationFactor?: number;
			itemId: string;
			quantity: number;
			scope: "board" | "inventory" | "board_or_inventory";
			type: "passive";
	  }
	| {
			distance: number;
			durationFactor?: number;
			itemIds: string[];
			type: "proximity";
	  };

type TestProductInput = {
	capacity: number;
	consume: boolean;
	itemId: string;
	quantity: number;
};

type TestProduct = {
	hinderedBy?: TestGameHindrance[];
	activatesEffectId?: string;
	durationMs: number;
	tags?: string[];
	visibility?: "visible" | "hidden";
	inputRefId?: string;
	name: string;
	outputTableId?: string;
	placement: "board_then_inventory";
	requirementIds: string[];
};

type TestItemStorage = "board" | "inventory" | "both";

type TestItemWithMaxCount = {
	maxCount?: number;
};

type TestCraftRecipe = {
	durationMs: number;
	inputs: {
		consume: boolean;
		itemId: string;
		quantity: number;
	}[];
	requirements: TestActivationRequirement[];
	resultItemId: string;
};

const createValidConfigValue = () => ({
	version: 1,
	game: {
		id: "game:test",
		title: "Test",
		board: {
			width: 2,
			height: 2,
		},
		inventory: {
			slots: 2,
		},
	},
	resources: {
		"resource:item": {
			data: "item-bytes",
		},
		"resource:ui": {
			data: "ui-bytes",
		},
	},
	assets: {
		"asset:item": {
			kind: "item",
			label: "Item",
			render: "plain",
			resourceId: "resource:item",
		},
		"asset:ui": {
			kind: "ui",
			label: "UI",
			resourceId: "resource:ui",
		},
	},
	items: {
		"item:producer": {
			assetId: "asset:item",
			code: "producer",
			description: "Producer",
			maxStackSize: 1,
			name: "Producer",
			producerId: "producer:test",
			tags: [],
			tier: 0,
		},
		"item:twig": {
			assetId: "asset:item",
			code: "twig",
			description: "Twig",
			maxStackSize: 3,
			name: "Twig",
			tags: [
				"wood",
			],
			tier: 0,
		},
		"item:plank": {
			assetId: "asset:item",
			code: "plank",
			description: "Plank",
			maxStackSize: 2,
			name: "Plank",
			tags: [],
			tier: 1,
		},
	},
	merge: {},
	requirements: {} as Record<string, TestGameRequirement>,
	effects: {} as Record<string, unknown>,
	producers: {
		"producer:test": {
			hinderedBy: [] as TestGameHindrance[],
			maxQueueSize: 1,
			productIds: [
				"product:test",
			],
			requirementIds: [] as string[],
			type: "producer",
		},
	},
	stashes: {},
	craftRecipes: {
		"craft:test": {
			durationMs: 1000,
			inputs: [
				{
					consume: true,
					itemId: "item:twig",
					quantity: 1,
				},
			],
			requirements: [] as TestActivationRequirement[],
			resultItemId: "item:plank",
		},
	} as Record<string, TestCraftRecipe>,
	inputs: {
		"input:test": {
			name: "Test input",
			inputs: [
				{
					capacity: 2,
					consume: true,
					itemId: "item:twig",
					quantity: 1,
				},
			],
		},
	},
	products: {
		"product:test": {
			hinderedBy: [] as TestGameHindrance[],
			durationMs: 1000,
			inputRefId: "input:test",
			name: "Test product",
			outputTableId: "loot:test",
			placement: "board_then_inventory",
			requirementIds: [] as string[],
		},
	} as Record<string, TestProduct>,
	lootTables: {
		"loot:test": {
			name: "Test loot",
			output: [
				{
					itemId: "item:twig",
					quantity: 1,
					type: "guaranteed",
				},
			],
		},
	},
	startingState: {
		board: [
			{
				itemId: "item:producer",
				x: 0,
				y: 0,
			},
		],
		inventory: [
			{
				itemId: "item:twig",
				quantity: 2,
			},
		],
	},
});

const setItemStorage = (
	config: ReturnType<typeof createValidConfigValue>,
	itemId: keyof ReturnType<typeof createValidConfigValue>["items"],
	storage: TestItemStorage,
) => {
	(
		config.items[itemId] as ReturnType<
			typeof createValidConfigValue
		>["items"][typeof itemId] & {
			storage: TestItemStorage;
		}
	).storage = storage;
};

const setItemExclusiveToIds = (
	config: ReturnType<typeof createValidConfigValue>,
	itemId: keyof ReturnType<typeof createValidConfigValue>["items"],
	exclusiveToIds: string[],
) => {
	(
		config.items[itemId] as ReturnType<
			typeof createValidConfigValue
		>["items"][typeof itemId] & {
			exclusiveToIds: string[];
		}
	).exclusiveToIds = exclusiveToIds;
};

describe("GameConfigSchema", () => {
	it("accepts the minimal valid test config", () => {
		expect(parseGameConfig(createValidConfigValue()).game.id).toBe("game:test");
	});

	it("defaults item storage to both", () => {
		expect(parseGameConfig(createValidConfigValue()).items["item:twig"].storage).toBe("both");
	});

	it("accepts optional item maxCount", () => {
		const config = createValidConfigValue();
		(config.items["item:twig"] as TestItemWithMaxCount).maxCount = 2;

		expect(parseGameConfig(config).items["item:twig"].maxCount).toBe(2);
	});

	it("rejects starting board item counts above item maxCount", () => {
		const config = createValidConfigValue();
		(config.items["item:twig"] as TestItemWithMaxCount).maxCount = 1;
		config.startingState.board.push(
			{
				itemId: "item:twig",
				x: 0,
				y: 1,
			},
			{
				itemId: "item:twig",
				x: 1,
				y: 1,
			},
		);

		expect(() => parseGameConfig(config)).toThrow(/maxCount is 1/);
	});

	it("rejects board-only items in starting inventory", () => {
		const config = createValidConfigValue();
		setItemStorage(config, "item:twig", "board");

		expect(() => parseGameConfig(config)).toThrow(/forbids inventory placement/);
	});

	it("rejects inventory-only items on the starting board", () => {
		const config = createValidConfigValue();
		setItemStorage(config, "item:producer", "inventory");

		expect(() => parseGameConfig(config)).toThrow(/forbids board placement/);
	});

	it("rejects starting inventory stack counts above configured slots", () => {
		const config = createValidConfigValue();
		config.game.inventory.slots = 1;
		config.startingState.inventory.push({
			itemId: "item:plank",
			quantity: 1,
		});

		expect(() => parseGameConfig(config)).toThrow(/Starting inventory has 2 stacks/);
	});

	it("rejects starting inventory quantities above item maxStackSize", () => {
		const config = createValidConfigValue();
		config.startingState.inventory[0].quantity = 4;

		expect(() => parseGameConfig(config)).toThrow(/Quantity must be <= item maxStackSize/);
	});

	it("rejects duplicate starting board cells", () => {
		const config = createValidConfigValue();
		config.startingState.board.push({
			itemId: "item:twig",
			x: 0,
			y: 0,
		});

		expect(() => parseGameConfig(config)).toThrow(/Duplicate starting board cell/);
	});

	it("rejects item definitions that point at non-item assets", () => {
		const config = createValidConfigValue();
		config.items["item:twig"].assetId = "asset:ui";

		expect(() => parseGameConfig(config)).toThrow(/must have kind/);
	});

	it("rejects duplicate item authoring codes", () => {
		const config = createValidConfigValue();
		config.items["item:plank"].code = "twig";

		expect(() => parseGameConfig(config)).toThrow(/Duplicate item code/);
	});

	it("rejects duplicate producer product lines", () => {
		const config = createValidConfigValue();
		config.producers["producer:test"].productIds.push("product:test");

		expect(() => parseGameConfig(config)).toThrow(/Duplicate product/);
	});

	it("rejects product definitions shared across producers", () => {
		const config = createValidConfigValue();
		(
			config.producers as Record<
				string,
				{
					maxQueueSize: number;
					productIds: string[];
					requirementIds: string[];
					type: string;
				}
			>
		)["producer:second"] = {
			maxQueueSize: 1,
			productIds: [
				"product:test",
			],
			requirementIds: [],
			type: "producer",
		};

		expect(() => parseGameConfig(config)).toThrow(/owned by exactly one producer/);
	});

	it("rejects product input refs shared across product lines", () => {
		const config = createValidConfigValue();
		config.products["product:second"] = {
			...config.products["product:test"],
			name: "Second product",
		};
		config.producers["producer:test"].productIds.push("product:second");

		expect(() => parseGameConfig(config)).toThrow(/Input ref.*input:test.*owned/);
	});

	it("allows separate product input refs to accept the same item", () => {
		const config = createValidConfigValue();
		(
			config.inputs as Record<
				string,
				{
					inputs: TestProductInput[];
					name: string;
				}
			>
		)["input:second"] = {
			name: "Second input",
			inputs: [
				{
					capacity: 2,
					consume: true,
					itemId: "item:twig",
					quantity: 1,
				},
			],
		};
		config.products["product:second"] = {
			...config.products["product:test"],
			inputRefId: "input:second",
			name: "Second product",
		};
		config.producers["producer:test"].productIds.push("product:second");

		expect(parseGameConfig(config).products["product:second"].inputRefId).toBe("input:second");
	});

	it("rejects activation input slots with capacity below required quantity", () => {
		const config = createValidConfigValue();
		config.inputs["input:test"].inputs[0].quantity = 3;
		config.inputs["input:test"].inputs[0].capacity = 2;

		expect(() => parseGameConfig(config)).toThrow(/Capacity must be >= quantity/);
	});

	it("rejects duplicate activation inputs for one product", () => {
		const config = createValidConfigValue();
		config.inputs["input:test"].inputs.push({
			capacity: 1,
			consume: true,
			itemId: "item:twig",
			quantity: 1,
		});

		expect(() => parseGameConfig(config)).toThrow(/Duplicate input item/);
	});

	it("rejects duplicate craft inputs", () => {
		const config = createValidConfigValue();
		config.craftRecipes["craft:test"].inputs.push({
			consume: true,
			itemId: "item:twig",
			quantity: 1,
		});

		expect(() => parseGameConfig(config)).toThrow(/Duplicate craft input item/);
	});

	it("rejects stored requirements with capacity below required quantity", () => {
		const config = createValidConfigValue();
		config.requirements["requirement:bad-stored"] = {
			capacity: 1,
			itemId: "item:twig",
			quantity: 2,
			type: "stored",
		};

		expect(() => parseGameConfig(config)).toThrow(/Capacity must be >= quantity/);
	});

	it("rejects duplicate requirement ids on product lines", () => {
		const config = createValidConfigValue();
		config.requirements["requirement:twig-passive"] = {
			itemId: "item:twig",
			quantity: 1,
			scope: "board",
			type: "passive",
		};
		config.products["product:test"].requirementIds.push(
			"requirement:twig-passive",
			"requirement:twig-passive",
		);

		expect(() => parseGameConfig(config)).toThrow(/Duplicate requirement id/);
	});

	it("rejects negative proximity duration factors", () => {
		const config = createValidConfigValue();
		config.requirements["requirement:near-twig"] = {
			distance: 1,
			durationFactor: -1,
			itemIds: [
				"item:twig",
			],
			type: "proximity",
		};

		expect(() => parseGameConfig(config)).toThrow(/durationFactor/);
	});

	it("rejects negative hindrance duration factors", () => {
		const config = createValidConfigValue();
		config.products["product:test"].hinderedBy = [
			{
				distance: 1,
				durationFactor: -1,
				itemIds: [
					"item:twig",
				],
				type: "proximity",
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/durationFactor/);
	});

	it("rejects hindrances that point at missing items", () => {
		const config = createValidConfigValue();
		config.producers["producer:test"].hinderedBy = [
			{
				itemId: "item:ghost",
				quantity: 1,
				scope: "board_or_inventory",
				type: "passive",
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/Missing item/);
	});

	it("accepts product visibility, tags, and active effect refs", () => {
		const config = createValidConfigValue();
		config.effects["effect:test"] = {
			name: "Test effect",
			operations: [
				{
					kind: "line.blockStart",
					target: {
						productIds: [
							"product:test",
						],
					},
				},
			],
			scope: "global",
		};
		config.products["product:test"].activatesEffectId = "effect:test";
		config.products["product:test"].outputTableId = undefined;
		config.products["product:test"].tags = [
			"tag:test",
		];
		config.products["product:test"].visibility = "hidden";

		expect(parseGameConfig(config).products["product:test"]).toMatchObject({
			activatesEffectId: "effect:test",
			tags: [
				"tag:test",
			],
			visibility: "hidden",
		});
	});

	it("rejects active effect product lines that also define output loot", () => {
		const config = createValidConfigValue();
		config.effects["effect:test"] = {
			name: "Test effect",
			operations: [
				{
					kind: "line.blockStart",
					target: {
						productIds: [
							"product:test",
						],
					},
				},
			],
			scope: "global",
		};
		config.products["product:test"].activatesEffectId = "effect:test";

		expect(() => parseGameConfig(config)).toThrow(/must not also define outputTableId/);
	});

	it("rejects product active effect refs that point at missing effects", () => {
		const config = createValidConfigValue();
		config.products["product:test"].activatesEffectId = "effect:ghost";
		config.products["product:test"].outputTableId = undefined;

		expect(() => parseGameConfig(config)).toThrow(/Missing effect/);
	});

	it("rejects proximity requirements that point at missing items", () => {
		const config = createValidConfigValue();
		config.requirements["requirement:near-ghost"] = {
			distance: 1,
			itemIds: [
				"item:ghost",
			],
			type: "proximity",
		};

		expect(() => parseGameConfig(config)).toThrow(/Missing item/);
	});

	it("accepts directional exclusive item ids without requiring symmetry", () => {
		const config = createValidConfigValue();
		setItemExclusiveToIds(config, "item:plank", [
			"item:twig",
		]);

		expect(parseGameConfig(config).items["item:plank"].exclusiveToIds).toEqual([
			"item:twig",
		]);
	});

	it("rejects exclusive item ids that point at missing items", () => {
		const config = createValidConfigValue();
		setItemExclusiveToIds(config, "item:plank", [
			"item:ghost",
		]);

		expect(() => parseGameConfig(config)).toThrow(/Missing item/);
	});

	it("rejects items that are exclusive to themselves", () => {
		const config = createValidConfigValue();
		setItemExclusiveToIds(config, "item:plank", [
			"item:plank",
		]);

		expect(() => parseGameConfig(config)).toThrow(/cannot be exclusive to itself/);
	});

	it("keeps structural checks for queue size and non-empty loot output", () => {
		const config = createValidConfigValue();
		config.producers["producer:test"].maxQueueSize = 0;
		config.lootTables["loot:test"].output = [];

		expect(() => parseGameConfig(config)).toThrow(/Too small/);
	});
});
