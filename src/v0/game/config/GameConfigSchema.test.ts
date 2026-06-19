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
	durationMs: number;
	inputRefId?: string;
	name: string;
	outputTableId?: string;
	placement: "board_then_inventory";
	requirementIds: string[];
};

type TestItemStorage = "board" | "inventory" | "both";

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

type TestUpgradeEffect =
	| {
			ms: number;
			productId: string;
			type: "product.duration.add";
	  }
	| {
			itemId: string;
			productId: string;
			quantity: number;
			type: "product.input.quantity.add";
	  }
	| {
			inputRefId: string;
			productId: string;
			type: "product.inputRef.set";
	  }
	| {
			productId: string;
			requirementIds: string[];
			type: "product.requirementIds.set";
	  }
	| {
			producerId: string;
			quantity: number;
			type: "producer.maxQueueSize.add";
	  }
	| {
			producerId: string;
			requirementIds: string[];
			type: "producer.requirementIds.set";
	  };

type TestUpgrade = {
	code: string;
	description: string;
	name: string;
	sort: number;
	tiers: {
		cost: {
			itemId: string;
			quantity: number;
		}[];
		durationMs: number;
		effects: TestUpgradeEffect[];
	}[];
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
			sort: 1,
		},
		"asset:ui": {
			kind: "ui",
			label: "UI",
			resourceId: "resource:ui",
			sort: 2,
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
			sort: 1,
			tags: [],
			tier: 0,
		},
		"item:twig": {
			assetId: "asset:item",
			code: "twig",
			description: "Twig",
			maxStackSize: 3,
			name: "Twig",
			sort: 2,
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
			sort: 3,
			tags: [],
			tier: 1,
		},
	},
	merge: {},
	requirements: {} as Record<string, TestGameRequirement>,
	producers: {
		"producer:test": {
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
	upgrades: {
		"upgrade:test": {
			code: "test-upgrade",
			description: "Upgrade",
			name: "Upgrade",
			sort: 1,
			tiers: [
				{
					cost: [
						{
							itemId: "item:twig",
							quantity: 1,
						},
					],
					durationMs: 1000,
					effects: [
						{
							ms: -100,
							productId: "product:test",
							type: "product.duration.add",
						},
					],
				},
			],
		},
	} as Record<string, TestUpgrade>,
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

	it("rejects duplicate item and upgrade authoring codes", () => {
		const config = createValidConfigValue();
		config.items["item:plank"].code = "twig";
		config.upgrades["upgrade:test-2"] = {
			...config.upgrades["upgrade:test"],
			code: "test-upgrade",
		};

		expect(() => parseGameConfig(config)).toThrow(/Duplicate item code|Duplicate upgrade code/);
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

	it("rejects upgrade prefixes that make product input refs shared", () => {
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
		config.upgrades["upgrade:test"].tiers[0].effects = [
			{
				inputRefId: "input:second",
				productId: "product:test",
				type: "product.inputRef.set",
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/Effective input ref.*input:second.*owned/);
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

	it("rejects upgrade prefixes that reduce product duration to zero", () => {
		const config = createValidConfigValue();
		config.upgrades["upgrade:test"].tiers[0].effects = [
			{
				ms: -1000,
				productId: "product:test",
				type: "product.duration.add",
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/durationMs must stay > 0/);
	});

	it("rejects upgrade prefixes that reduce product input quantity to zero", () => {
		const config = createValidConfigValue();
		config.upgrades["upgrade:test"].tiers[0].effects = [
			{
				itemId: "item:twig",
				productId: "product:test",
				quantity: -1,
				type: "product.input.quantity.add",
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/quantity must stay > 0/);
	});

	it("rejects upgrade prefixes that raise product input quantity above capacity", () => {
		const config = createValidConfigValue();
		config.upgrades["upgrade:test"].tiers[0].effects = [
			{
				itemId: "item:twig",
				productId: "product:test",
				quantity: 2,
				type: "product.input.quantity.add",
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/quantity must stay <= capacity \(2\)/);
	});

	it("rejects upgrade prefixes that reduce producer queue size below one", () => {
		const config = createValidConfigValue();
		config.upgrades["upgrade:test"].tiers[0].effects = [
			{
				producerId: "producer:test",
				quantity: -1,
				type: "producer.maxQueueSize.add",
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/maxQueueSize must stay > 0/);
	});

	it("validates product input quantity upgrades against the effective input ref", () => {
		const config = createValidConfigValue();
		(
			config.inputs as Record<
				string,
				{
					inputs: TestProductInput[];
					name: string;
				}
			>
		)["input:plank"] = {
			name: "Plank input",
			inputs: [
				{
					capacity: 2,
					consume: true,
					itemId: "item:plank",
					quantity: 1,
				},
			],
		};
		config.upgrades["upgrade:test"].tiers[0].effects = [
			{
				inputRefId: "input:plank",
				productId: "product:test",
				type: "product.inputRef.set",
			},
			{
				itemId: "item:plank",
				productId: "product:test",
				quantity: 1,
				type: "product.input.quantity.add",
			},
		];

		expect(parseGameConfig(config).upgrades["upgrade:test"].tiers[0].effects).toHaveLength(2);
	});

	it("rejects product input quantity upgrades that target the input ref replaced earlier in the same prefix", () => {
		const config = createValidConfigValue();
		(
			config.inputs as Record<
				string,
				{
					inputs: TestProductInput[];
					name: string;
				}
			>
		)["input:plank"] = {
			name: "Plank input",
			inputs: [
				{
					capacity: 2,
					consume: true,
					itemId: "item:plank",
					quantity: 1,
				},
			],
		};
		config.upgrades["upgrade:test"].tiers[0].effects = [
			{
				inputRefId: "input:plank",
				productId: "product:test",
				type: "product.inputRef.set",
			},
			{
				itemId: "item:twig",
				productId: "product:test",
				quantity: 1,
				type: "product.input.quantity.add",
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/Effective product.*input:plank.*item:twig/);
	});

	it("keeps structural checks for queue size and non-empty loot output", () => {
		const config = createValidConfigValue();
		config.producers["producer:test"].maxQueueSize = 0;
		config.lootTables["loot:test"].output = [];

		expect(() => parseGameConfig(config)).toThrow(/Too small/);
	});
});
