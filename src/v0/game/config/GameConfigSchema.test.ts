import { describe, expect, it } from "vitest";
import { parseGameConfig } from "~/v0/game/config/GameConfigSchema";

type TestProductInput = {
	capacity: number;
	consume: boolean;
	itemId: string;
	quantity: number;
	mode?: "exact" | "upTo";
};

type TestProduct = {
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
	},
	assets: {
		"asset:item": {
			label: "Item",
			render: "plain",
			resourceId: "resource:item",
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
	effects: {} as Record<string, unknown>,
	producers: {
		"item:producer": {
			maxQueueSize: 1,
			productIds: [
				"product:test",
			],
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
			resultItemId: "item:plank",
		},
	} as Record<string, TestCraftRecipe>,
	products: {
		"product:test": {
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

	it("rejects obsolete asset kind fields", () => {
		const config = createValidConfigValue();
		(config.assets["asset:item"] as Record<string, unknown>).kind = "item";

		expect(() => parseGameConfig(config)).toThrow(/Unrecognized key.*kind/);
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
				}
			>
		)["producer:second"] = {
			maxQueueSize: 1,
			productIds: [
				"product:test",
			],
		};

		expect(() => parseGameConfig(config)).toThrow(/owned by exactly one producer/);
	});

	it("rejects activation input slots with capacity below required quantity", () => {
		const config = createValidConfigValue();
		config.products["product:test"].inputs![0]!.quantity = 3;
		config.products["product:test"].inputs![0]!.capacity = 2;

		expect(() => parseGameConfig(config)).toThrow(/Capacity must be >= quantity/);
	});

	it("accepts up-to activation inputs", () => {
		const config = createValidConfigValue();
		config.products["product:test"].inputs![0] = {
			capacity: 4,
			consume: true,
			itemId: "item:twig",
			mode: "upTo",
			quantity: 4,
		};

		expect(parseGameConfig(config).products["product:test"].inputs![0]).toMatchObject({
			itemId: "item:twig",
			mode: "upTo",
			quantity: 4,
		});
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

	it("rejects product active effect refs that point at missing effects", () => {
		const config = createValidConfigValue();
		config.products["product:test"].activatesEffectId = "effect:ghost";

		expect(() => parseGameConfig(config)).toThrow(/Missing effect/);
	});

	it("rejects effects without explicit polarity", () => {
		const config = createValidConfigValue();
		config.effects = {
			"effect:test": {
				grants: [
					{
						id: "grant:test",
						name: "Test",
					},
				],
				name: "Test Grant",
			},
		};

		expect(() => parseGameConfig(config)).toThrow(/polarity/);
	});

	it("rejects product-line-owned extra output chance effects", () => {
		const config: any = createValidConfigValue();
		config.effects = {
			"effect:test": {
				polarity: "buff",
				grants: [
					{
						id: "grant:test",
						name: "Test",
					},
				],
				name: "Test Grant",
			},
		};
		config.products["product:test"].effects = [
			{
				chance: 0.5,
				display: "whenActive",
				kind: "grant.loot.extraOutputChance.add",
				outputItems: {
					items: {
						anyOf: [
							{
								ids: [
									"item:twig",
								],
							},
						],
					},
				},
				selector: {
					allOf: [
						{
							ids: [
								"grant:test",
							],
						},
					],
				},
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/Invalid discriminator value/);
	});

	it("rejects line-owned modifier effects that would be runtime no-ops", () => {
		const config: any = createValidConfigValue();
		config.effects = {
			"effect:test": {
				polarity: "buff",
				grants: [
					{
						id: "grant:test",
						name: "Test",
					},
				],
				name: "Test Grant",
			},
		};
		config.products["product:test"].effects = [
			{
				display: "whenActive",
				kind: "grant.duration.multiply",
				multiplier: 1,
				selector: {
					allOf: [
						{
							ids: [
								"grant:test",
							],
						},
					],
				},
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/no-op/);

		config.products["product:test"].effects = [
			{
				display: "whenActive",
				kind: "nearby.duration.multiply",
				items: {
					anyOf: [
						{
							ids: [
								"item:twig",
							],
						},
					],
				},
				radius: 1,
				bands: [
					{
						minDistance: 0,
						multiplier: 1,
					},
				],
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/non-1 multiplier/);
	});

	it("rejects zero-chance drop-owned extra output effects", () => {
		const config: any = createValidConfigValue();
		config.effects = {
			"effect:test": {
				polarity: "buff",
				grants: [
					{
						id: "grant:test",
						name: "Test",
					},
				],
				name: "Test Grant",
			},
		};
		config.products["product:test"].output[0].effects = [
			{
				chance: 0,
				display: "whenActive",
				kind: "grant.loot.extraOutputChance.add",
				selector: {
					allOf: [
						{
							ids: [
								"grant:test",
							],
						},
					],
				},
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/Too small/);
	});

	it("rejects drop-owned nearby requirements that target missing items", () => {
		const config: any = createValidConfigValue();
		config.products["product:test"].output[0].effects = [
			{
				display: "always",
				items: {
					anyOf: [
						{
							ids: [
								"item:ghost",
							],
						},
					],
				},
				kind: "nearby.require",
				phase: "start",
				radius: 1,
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/Missing item/);
	});

	it("rejects craft effects that the craft runtime does not support", () => {
		const config: any = createValidConfigValue();
		config.craftRecipes["item:craft-target"].effects = [
			{
				bands: [
					{
						maxDistance: 1,
						minDistance: 0,
						multiplier: 0.5,
					},
				],
				display: "whenActive",
				items: {
					anyOf: [
						{
							ids: [
								"item:twig",
							],
						},
					],
				},
				kind: "nearby.duration.multiply",
				radius: 1,
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/producer product-line effect/);
	});

	it("rejects craft visibility requirements because craft targets have no line visibility", () => {
		const config: any = createValidConfigValue();
		config.effects = {
			"effect:test": {
				polarity: "neutral",
				grants: [
					{
						id: "grant:test",
						name: "Test",
					},
				],
				name: "Test Grant",
			},
		};
		config.craftRecipes["item:craft-target"].effects = [
			{
				display: "never",
				kind: "grant.require",
				phase: "visibility",
				selector: {
					allOf: [
						{
							ids: [
								"grant:test",
							],
						},
					],
				},
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/Craft recipe grant requirements/);
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
			resultItemId: "producer:a",
		};
		config.producers["producer:a"] = {
			maxQueueSize: 1,
			productIds: [
				"product:producer-a:blueprint-a",
			],
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
		};

		expect(() => parseGameConfig(config)).toThrow(/Blueprint A -> Blueprint A/);
	});

	it("rejects producer progression that is cross-locked behind another future producer", () => {
		const config: any = createValidConfigValue();
		config.items["item:blueprint-a"] = {
			assetId: "asset:item",
			description: "Blueprint A",
			maxStackSize: 1,
			name: "Blueprint A",
			tags: [
				"blueprint",
			],
			tier: 0,
		};
		config.items["item:blueprint-b"] = {
			assetId: "asset:item",
			description: "Blueprint B",
			maxStackSize: 1,
			name: "Blueprint B",
			tags: [
				"blueprint",
			],
			tier: 0,
		};
		config.items["item:a-part"] = {
			assetId: "asset:item",
			description: "Part A",
			maxStackSize: 1,
			name: "Part A",
			tags: [],
			tier: 1,
		};
		config.items["item:b-part"] = {
			assetId: "asset:item",
			description: "Part B",
			maxStackSize: 1,
			name: "Part B",
			tags: [],
			tier: 1,
		};
		config.items["producer:a"] = {
			assetId: "asset:item",
			description: "Producer A",
			maxStackSize: 1,
			name: "Producer A",
			tags: [
				"producer",
			],
			tier: 1,
		};
		config.items["producer:b"] = {
			assetId: "asset:item",
			description: "Producer B",
			maxStackSize: 1,
			name: "Producer B",
			tags: [
				"producer",
			],
			tier: 1,
		};
		config.products["product:blueprint-a"] = {
			durationMs: 1000,
			name: "Blueprint A",
			output: [
				{
					itemId: "item:blueprint-a",
					type: "guaranteed",
				},
			],
			placement: "board_then_inventory",
		};
		config.products["product:blueprint-b"] = {
			durationMs: 1000,
			name: "Blueprint B",
			output: [
				{
					itemId: "item:blueprint-b",
					type: "guaranteed",
				},
			],
			placement: "board_then_inventory",
		};
		config.producers["item:producer"].productIds.push(
			"product:blueprint-a",
			"product:blueprint-b",
		);
		config.craftRecipes["item:blueprint-a"] = {
			durationMs: 1000,
			inputs: [
				{
					consume: true,
					itemId: "item:b-part",
					quantity: 1,
				},
			],
			resultItemId: "producer:a",
		};
		config.craftRecipes["item:blueprint-b"] = {
			durationMs: 1000,
			inputs: [
				{
					consume: true,
					itemId: "item:a-part",
					quantity: 1,
				},
			],
			resultItemId: "producer:b",
		};
		config.products["product:a-part"] = {
			durationMs: 1000,
			name: "Part A",
			output: [
				{
					itemId: "item:a-part",
					type: "guaranteed",
				},
			],
			placement: "board_then_inventory",
		};
		config.products["product:b-part"] = {
			durationMs: 1000,
			name: "Part B",
			output: [
				{
					itemId: "item:b-part",
					type: "guaranteed",
				},
			],
			placement: "board_then_inventory",
		};
		config.producers["producer:a"] = {
			maxQueueSize: 1,
			productIds: [
				"product:a-part",
			],
		};
		config.producers["producer:b"] = {
			maxQueueSize: 1,
			productIds: [
				"product:b-part",
			],
		};

		expect(() => parseGameConfig(config)).toThrow(/Soft-lock risk.*producer:a.*item:b-part/s);
	});

	it("rejects progression grant requirements that no item or product can provide", () => {
		const config: any = createValidConfigValue();
		config.items["item:producer"].tags = [
			"producer",
		];
		config.effects = {
			"effect:test": {
				grants: [
					{
						id: "grant:test",
						name: "Test Grant",
					},
				],
				name: "Test Effect",
				polarity: "neutral",
			},
		};
		config.products["product:test"].effects = [
			{
				display: "whenMissing",
				kind: "grant.require",
				phase: "start",
				selector: {
					allOf: [
						{
							ids: [
								"grant:test",
							],
						},
					],
				},
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/can never be satisfied/);
	});

	it("rejects line effects that require and block the same grant", () => {
		const config: any = createValidConfigValue();
		config.items["item:producer"].tags = [
			"producer",
		];
		config.effects = {
			"effect:test": {
				grants: [
					{
						id: "grant:test",
						name: "Test Grant",
					},
				],
				name: "Test Effect",
				polarity: "neutral",
			},
		};
		config.items["item:twig"].passiveEffectIds = [
			"effect:test",
		];
		config.products["product:test"].effects = [
			{
				display: "whenMissing",
				kind: "grant.require",
				phase: "start",
				selector: {
					allOf: [
						{
							ids: [
								"grant:test",
							],
						},
					],
				},
			},
			{
				display: "whenActive",
				kind: "grant.blockStart",
				selector: {
					anyOf: [
						{
							ids: [
								"grant:test",
							],
						},
					],
				},
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/requires and blocks the same/);
	});

	it("rejects nearby requirements that only match inventory-only items", () => {
		const config: any = createValidConfigValue();
		config.items["item:producer"].tags = [
			"producer",
		];
		config.items["item:twig"].storage = "inventory";
		config.products["product:test"].effects = [
			{
				display: "always",
				items: {
					anyOf: [
						{
							ids: [
								"item:twig",
							],
						},
					],
				},
				kind: "nearby.require",
				phase: "start",
				radius: 1,
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/matches no board-placeable item/);
	});

	it("keeps structural checks for queue size and non-empty inline output", () => {
		const config = createValidConfigValue();
		config.producers["item:producer"].maxQueueSize = 0;
		config.products["product:test"].output = [];

		expect(() => parseGameConfig(config)).toThrow(/Too small/);
	});
});
