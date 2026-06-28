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
	inputs?: TestProductInput[];
	name: string;
	output?: {
		chance?: number;
		entries?: {
			itemId: string;
			quantity?: number;
			weight: number;
		}[];
		itemId?: string;
		quantity?: number;
		rolls?: number;
		type: "chance" | "guaranteed" | "weighted";
	}[];
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
	requirements: TestGameRequirement[];
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
			description: "Producer",
			maxStackSize: 1,
			name: "Producer",
			tags: [],
			tier: 0,
		},
		"item:twig": {
			assetId: "asset:item",
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
			description: "Plank",
			maxStackSize: 2,
			name: "Plank",
			tags: [],
			tier: 1,
		},
		"item:craft-target": {
			assetId: "asset:item",
			description: "Craft target",
			maxStackSize: 1,
			name: "Craft Target",
			tags: [],
			tier: 0,
		},
	},
	merge: {},
	requirements: {} as Record<string, TestGameRequirement>,
	effects: {} as Record<string, unknown>,
	producers: {
		"item:producer": {
			hinderedBy: [] as TestGameHindrance[],
			maxQueueSize: 1,
			productIds: [
				"product:test",
			],
			requirementIds: [] as string[],
		},
	},
	stashes: {},
	craftRecipes: {
		"item:craft-target": {
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
	products: {
		"product:test": {
			hinderedBy: [] as TestGameHindrance[],
			durationMs: 1000,
			inputs: [
				{
					capacity: 2,
					consume: true,
					itemId: "item:twig",
					quantity: 1,
				},
			],
			name: "Test product",
			output: [
				{
					itemId: "item:twig",
					quantity: 1,
					type: "guaranteed",
				},
			],
			placement: "board_then_inventory",
			requirementIds: [] as string[],
		},
	} as Record<string, TestProduct>,
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

	it("rejects duplicate producer product lines", () => {
		const config = createValidConfigValue();
		config.producers["item:producer"].productIds.push("product:test");

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
				}
			>
		)["producer:second"] = {
			maxQueueSize: 1,
			productIds: [
				"product:test",
			],
			requirementIds: [],
		};

		expect(() => parseGameConfig(config)).toThrow(/owned by exactly one producer/);
	});

	it("rejects activation input slots with capacity below required quantity", () => {
		const config = createValidConfigValue();
		config.products["product:test"].inputs![0]!.quantity = 3;
		config.products["product:test"].inputs![0]!.capacity = 2;

		expect(() => parseGameConfig(config)).toThrow(/Capacity must be >= quantity/);
	});

	it("rejects duplicate activation inputs for one product", () => {
		const config = createValidConfigValue();
		config.products["product:test"].inputs!.push({
			capacity: 1,
			consume: true,
			itemId: "item:twig",
			quantity: 1,
		});

		expect(() => parseGameConfig(config)).toThrow(/Duplicate input item/);
	});

	it("rejects duplicate craft inputs", () => {
		const config = createValidConfigValue();
		config.craftRecipes["item:craft-target"].inputs.push({
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
		config.producers["item:producer"].hinderedBy = [
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
		config.products["product:test"].output = undefined;
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

	it("accepts explicit all-target effects", () => {
		const config = createValidConfigValue();
		config.effects["effect:test"] = {
			name: "Test effect",
			operations: [
				{
					kind: "line.blockStart",
					target: {
						all: true,
					},
				},
			],
			scope: "global",
		};

		expect(parseGameConfig(config).effects["effect:test"]?.operations[0]?.target).toEqual({
			all: true,
		});
	});

	it("rejects selector-less effects without explicit all target", () => {
		const config = createValidConfigValue();
		config.effects["effect:test"] = {
			name: "Test effect",
			operations: [
				{
					kind: "line.blockStart",
					target: {},
				},
			],
			scope: "global",
		};

		expect(() => parseGameConfig(config)).toThrow(/explicit all: true/);
	});

	it("rejects all-target effects combined with selectors", () => {
		const config = createValidConfigValue();
		config.effects["effect:test"] = {
			name: "Test effect",
			operations: [
				{
					kind: "line.blockStart",
					target: {
						all: true,
						productIds: [
							"product:test",
						],
					},
				},
			],
			scope: "global",
		};

		expect(() => parseGameConfig(config)).toThrow(/must not be combined/);
	});

	it("rejects local effects that claim inventory source scope", () => {
		const config = createValidConfigValue();
		config.effects["effect:local-inventory"] = {
			name: "Local inventory lie",
			operations: [
				{
					kind: "item.blockCreate",
					target: {
						itemIds: [
							"item:plank",
						],
					},
				},
			],
			radius: 1,
			scope: "local",
			sourceScope: "both",
		};

		expect(() => parseGameConfig(config)).toThrow(/inventory sources have no board cell/);
	});

	it("rejects active effect product lines with inventory-only source scope", () => {
		const config = createValidConfigValue();
		config.effects["effect:inventory-only"] = {
			name: "Inventory-only boost",
			operations: [
				{
					kind: "duration.multiply",
					multiplier: 0.5,
					target: {
						productIds: [
							"product:test",
						],
					},
				},
			],
			scope: "global",
			sourceScope: "inventory",
		};
		config.products["product:test"].activatesEffectId = "effect:inventory-only";
		config.products["product:test"].output = undefined;

		expect(() => parseGameConfig(config)).toThrow(/inventory-only sourceScope/);
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

		expect(() => parseGameConfig(config)).toThrow(/must not also define output/);
	});

	it("rejects product active effect refs that point at missing effects", () => {
		const config = createValidConfigValue();
		config.products["product:test"].activatesEffectId = "effect:ghost";

		expect(() => parseGameConfig(config)).toThrow(/Missing effect/);
	});

	it("rejects craft results that cannot replace the board target", () => {
		const config = createValidConfigValue();
		setItemStorage(config, "item:plank", "inventory");

		expect(() => parseGameConfig(config)).toThrow(/must be placeable on the board/);
	});

	it("rejects non-consumed craft inputs until craft can return preserved inputs", () => {
		const config = createValidConfigValue();
		config.craftRecipes["item:craft-target"].inputs[0] = {
			...config.craftRecipes["item:craft-target"].inputs[0],
			consume: false,
		};

		expect(() => parseGameConfig(config)).toThrow(/Craft inputs must currently be consumed/);
	});

	it("rejects blueprint craft recipes that require their own target", () => {
		const config: any = createValidConfigValue();
		config.items["item:blueprint-house-t1"] = {
			assetId: "asset:item",
			description: "House I Blueprint",
			maxStackSize: 1,
			name: "House I Blueprint",
			tags: [],
			tier: 0,
		};
		config.items["producer:house-t1"] = {
			assetId: "asset:item",
			description: "House I",
			maxStackSize: 1,
			name: "House I",
			tags: [],
			tier: 1,
		};
		config.craftRecipes["item:blueprint-house-t1"] = {
			durationMs: 1000,
			inputs: [
				{
					consume: true,
					itemId: "item:blueprint-house-t1",
					quantity: 1,
				},
			],
			requirements: [],
			resultItemId: "producer:house-t1",
		};

		expect(() => parseGameConfig(config)).toThrow(/House I Blueprint -> House I Blueprint/);
	});

	it("rejects indirect blueprint dependency cycles through crafted buildings", () => {
		const config: any = createValidConfigValue();
		config.items["item:blueprint-a"] = {
			assetId: "asset:item",
			description: "Blueprint A",
			maxStackSize: 1,
			name: "Blueprint A",
			tags: [],
			tier: 0,
		};
		config.items["item:blueprint-b"] = {
			assetId: "asset:item",
			description: "Blueprint B",
			maxStackSize: 1,
			name: "Blueprint B",
			tags: [],
			tier: 0,
		};
		config.items["producer:a"] = {
			assetId: "asset:item",
			description: "A",
			maxStackSize: 1,
			name: "A",
			tags: [],
			tier: 1,
		};
		config.items["producer:b"] = {
			assetId: "asset:item",
			description: "B",
			maxStackSize: 1,
			name: "B",
			tags: [],
			tier: 1,
		};
		config.craftRecipes["item:blueprint-a"] = {
			durationMs: 1000,
			inputs: [
				{
					consume: true,
					itemId: "producer:b",
					quantity: 1,
				},
			],
			requirements: [],
			resultItemId: "producer:a",
		};
		config.craftRecipes["item:blueprint-b"] = {
			durationMs: 1000,
			inputs: [
				{
					consume: true,
					itemId: "producer:a",
					quantity: 1,
				},
			],
			requirements: [],
			resultItemId: "producer:b",
		};

		expect(() => parseGameConfig(config)).toThrow(/Blueprint A -> Blueprint B -> Blueprint A/);
	});

	it("rejects blueprint product lines that require the building they unlock", () => {
		const config: any = createValidConfigValue();
		config.items["item:blueprint-a"] = {
			assetId: "asset:item",
			description: "Blueprint A",
			maxStackSize: 1,
			name: "Blueprint A",
			tags: [],
			tier: 0,
		};
		config.items["producer:a"] = {
			assetId: "asset:item",
			description: "A",
			maxStackSize: 1,
			name: "A",
			tags: [],
			tier: 1,
		};
		config.craftRecipes["item:blueprint-a"] = {
			durationMs: 1000,
			inputs: [
				{
					consume: true,
					itemId: "item:twig",
					quantity: 1,
				},
			],
			requirements: [],
			resultItemId: "producer:a",
		};
		config.producers["producer:a"] = {
			maxQueueSize: 1,
			productIds: [
				"product:producer-a:blueprint-a",
			],
			requirementIds: [],
		};
		config.products["product:producer-a:blueprint-a"] = {
			durationMs: 1000,
			name: "Blueprint A",
			output: [
				{
					itemId: "item:blueprint-a",
					type: "guaranteed",
				},
			],
			placement: "board_then_inventory",
			requirementIds: [],
		};

		expect(() => parseGameConfig(config)).toThrow(/Blueprint A -> Blueprint A/);
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

	it("accepts inline craft proximity requirements", () => {
		const config = createValidConfigValue();
		config.craftRecipes["item:craft-target"].requirements = [
			{
				distance: 1,
				itemIds: [
					"item:twig",
				],
				type: "proximity",
			},
		];

		expect(
			parseGameConfig(config).craftRecipes["item:craft-target"]?.requirements,
		).toMatchObject([
			{
				distance: 1,
				itemIds: [
					"item:twig",
				],
				type: "proximity",
			},
		]);
	});

	it("allows multiple inline proximity requirements with the same items and different distances", () => {
		const config = createValidConfigValue();
		config.craftRecipes["item:craft-target"].requirements = [
			{
				distance: 1,
				itemIds: [
					"item:twig",
					"item:plank",
				],
				type: "proximity",
			},
			{
				distance: 2,
				itemIds: [
					"item:plank",
					"item:twig",
				],
				type: "proximity",
			},
		];

		expect(() => parseGameConfig(config)).not.toThrow();
	});

	it("accepts item create blocking effects", () => {
		const config = createValidConfigValue();
		config.effects["effect:block-plank"] = {
			name: "Block plank",
			operations: [
				{
					kind: "item.blockCreate",
					reason: "No planks today.",
					target: {
						itemIds: [
							"item:plank",
						],
					},
				},
			],
			scope: "global",
		};

		expect(parseGameConfig(config).effects["effect:block-plank"]?.operations[0]).toMatchObject({
			kind: "item.blockCreate",
			reason: "No planks today.",
		});
	});

	it("rejects item create blocking effects that point at missing items", () => {
		const config = createValidConfigValue();
		config.effects["effect:block-ghost"] = {
			name: "Block ghost",
			operations: [
				{
					kind: "item.blockCreate",
					target: {
						itemIds: [
							"item:ghost",
						],
					},
				},
			],
			scope: "global",
		};

		expect(() => parseGameConfig(config)).toThrow(/Missing item/);
	});

	it("keeps structural checks for queue size and non-empty inline output", () => {
		const config = createValidConfigValue();
		config.producers["item:producer"].maxQueueSize = 0;
		config.products["product:test"].output = [];

		expect(() => parseGameConfig(config)).toThrow(/Too small/);
	});
});
