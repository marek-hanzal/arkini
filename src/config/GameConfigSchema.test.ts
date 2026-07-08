import { describe, expect, it } from "vitest";
import { parseGameConfig } from "~/config/GameConfigSchema";

type TestItemStorage = "board" | "inventory" | "both";

type TestItemWithMaxCount = {
	maxCount?: number;
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
			assetIds: [
				"asset:item",
			],
			description: "Producer",
			maxStackSize: 1,
			name: "Producer",
			producer: {
				maxQueueSize: 1,
				lines: [
					{
						durationMs: 1000,
						id: "line:test",
						inputs: [
							{
								capacity: 2,
								consume: true,
								itemId: "item:twig",
								quantity: 1,
							},
						],
						name: "Test line",
						output: [
							{
								itemId: "item:twig",
								quantity: 1,
								type: "guaranteed",
							},
						],
						placement: "board_then_inventory",
					},
				],
			},
			tags: [],
			tier: 0,
		},
		"item:twig": {
			assetIds: [
				"asset:item",
			],
			description: "Twig",
			maxStackSize: 3,
			name: "Twig",
			tags: [
				"wood",
			],
			tier: 0,
		},
		"item:plank": {
			assetIds: [
				"asset:item",
			],
			description: "Plank",
			maxStackSize: 2,
			name: "Plank",
			tags: [],
			tier: 1,
		},
		"item:craft-target": {
			assetIds: [
				"asset:item",
			],
			craft: {
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
			description: "Craft target",
			maxStackSize: 1,
			name: "Craft Target",
			tags: [],
			tier: 0,
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

const readTestProducer = (config: any, itemId: string) => {
	const producer = config.items[itemId]?.producer;
	if (!producer) throw new Error(`Missing producer capability on "${itemId}".`);
	return producer;
};

const readTestLine = (config: any, lineId: string) => {
	for (const item of Object.values<any>(config.items ?? {})) {
		const line = item.producer?.lines?.find((line: any) => line.id === lineId);
		if (line) return line;
		if (item.stash?.line?.id === lineId) return item.stash.line;
	}
	throw new Error(`Missing line "${lineId}".`);
};

const readTestCraft = (config: any, itemId: string) => {
	const craft = config.items[itemId]?.craft;
	if (!craft) throw new Error(`Missing craft recipe on "${itemId}".`);
	return craft;
};

const createTestEffect = ({
	effectId = "effect:test",
	grantId = "grant:test",
	polarity = "neutral",
}: {
	effectId?: string;
	grantId?: string;
	polarity?: "buff" | "debuff" | "mixed" | "neutral";
} = {}) => ({
	grants: [
		{
			id: grantId,
			name: "Test Grant",
		},
	],
	id: effectId,
	name: "Test Effect",
	polarity,
	sourceScope: "both" as const,
});

const addTestGrantSource = (config: any, props?: Parameters<typeof createTestEffect>[0]) => {
	config.items["item:twig"].effects = [
		...((config.items["item:twig"].effects ?? []) as unknown[]),
		createTestEffect(props),
	];
};

const setTestCraft = (config: any, itemId: string, craft: unknown) => {
	config.items[itemId] = {
		...(config.items[itemId] ?? {
			assetIds: [
				"asset:item",
			],
			description: itemId,
			maxStackSize: 1,
			name: itemId,
			tags: [],
			tier: 0,
		}),
		craft,
	};
};

const setTestProducer = (config: any, itemId: string, producer: unknown) => {
	config.items[itemId] = {
		...(config.items[itemId] ?? {
			assetIds: [
				"asset:item",
			],
			description: itemId,
			maxStackSize: 1,
			name: itemId,
			tags: [],
			tier: 0,
		}),
		producer,
	};
};

const appendTestLine = (config: any, itemId: string, line: unknown) => {
	const item = config.items[itemId];
	if (!item?.producer) {
		throw new Error(`Missing producer capability on "${itemId}".`);
	}
	item.producer.lines.push(line);
};

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

const addReachabilityTargetProducer = (config: any, itemId = "producer:future") => {
	config.items[itemId] = {
		assetIds: [
			"asset:item",
		],
		description: itemId,
		maxStackSize: 1,
		name: itemId,
		producer: {
			maxQueueSize: 1,
			lines: [
				{
					durationMs: 1000,
					id: "line:future",
					name: "Future",
					output: [
						{
							itemId: "item:twig",
							type: "guaranteed",
						},
					],
					placement: "board_then_inventory",
				},
			],
		},
		tags: [
			"producer",
		],
		tier: 1,
	};
};

describe("GameConfigSchema", () => {
	it("accepts the minimal valid test config", () => {
		expect(parseGameConfig(createValidConfigValue()).game.id).toBe("game:test");
	});

	it("defaults item storage to both", () => {
		expect(parseGameConfig(createValidConfigValue()).items["item:twig"].storage).toBe("both");
	});

	it("accepts keep-target merge rules with placement output", () => {
		const config = createValidConfigValue();
		(config.items["item:twig"] as any).merges = [
			{
				output: [
					{
						itemId: "item:plank",
						quantity: 1,
						type: "guaranteed",
					},
				],
				targetMode: "keep",
				withItemId: "item:producer",
			},
		];

		expect(parseGameConfig(config).items["item:twig"].merges?.[0]).toMatchObject({
			targetMode: "keep",
			withItemId: "item:producer",
		});
	});

	it("rejects keep-target merge rules with missing output items", () => {
		const config = createValidConfigValue();
		(config.items["item:twig"] as any).merges = [
			{
				output: [
					{
						itemId: "item:missing",
						quantity: 1,
						type: "guaranteed",
					},
				],
				targetMode: "keep",
				withItemId: "item:producer",
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/item:missing/);
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

	it("rejects obsolete single item asset ids", () => {
		const config = createValidConfigValue();
		const item = config.items["item:twig"] as Record<string, unknown>;
		delete item.assetIds;
		item.assetId = "asset:item";

		expect(() => parseGameConfig(config)).toThrow(/Unrecognized key.*assetId/);
	});

	it("rejects duplicate lines", () => {
		const config = createValidConfigValue();
		readTestProducer(config, "item:producer").lines.push({
			...readTestLine(config, "line:test"),
		});

		expect(() => parseGameConfig(config)).toThrow(/Duplicate line/);
	});

	it("accepts same local line id under different producers", () => {
		const config: any = createValidConfigValue();
		config.items["producer:second"] = {
			assetIds: [
				"asset:item",
			],
			description: "Second producer",
			maxStackSize: 1,
			name: "Second Producer",
			tags: [],
			tier: 0,
		};
		setTestProducer(config, "producer:second", {
			maxQueueSize: 1,
			lines: [
				{
					...readTestLine(config, "line:test"),
				},
			],
		});
		config.startingState.board.push({
			itemId: "producer:second",
			x: 1,
			y: 1,
		});

		expect(() => parseGameConfig(config)).not.toThrow();
	});

	it("rejects activation input slots with capacity below required quantity", () => {
		const config = createValidConfigValue();
		readTestLine(config, "line:test").inputs![0]!.quantity = 3;
		readTestLine(config, "line:test").inputs![0]!.capacity = 2;

		expect(() => parseGameConfig(config)).toThrow(/Capacity must be >= quantity/);
	});

	it("accepts up-to activation inputs", () => {
		const config = createValidConfigValue();
		readTestLine(config, "line:test").inputs![0] = {
			capacity: 4,
			consume: true,
			itemId: "item:twig",
			mode: "upTo",
			quantity: 4,
		};

		expect(
			parseGameConfig(config).items["item:producer"].producer?.lines[0]?.inputs?.[0],
		).toMatchObject({
			itemId: "item:twig",
			mode: "upTo",
			quantity: 4,
		});
	});

	it("rejects duplicate activation inputs for one product", () => {
		const config = createValidConfigValue();
		readTestLine(config, "line:test").inputs!.push({
			capacity: 1,
			consume: true,
			itemId: "item:twig",
			quantity: 1,
		});

		expect(() => parseGameConfig(config)).toThrow(/Duplicate input item/);
	});

	it("rejects duplicate craft inputs", () => {
		const config = createValidConfigValue();
		readTestCraft(config, "item:craft-target").inputs.push({
			consume: true,
			itemId: "item:twig",
			quantity: 1,
		});

		expect(() => parseGameConfig(config)).toThrow(/Duplicate craft input item/);
	});

	it("rejects active line effects without explicit polarity", () => {
		const config = createValidConfigValue();
		readTestLine(config, "line:test").effect = {
			grants: [
				{
					id: "grant:test",
					name: "Test",
				},
			],
			id: "effect:test",
			name: "Test Grant",
		};

		expect(() => parseGameConfig(config)).toThrow(/polarity/);
	});

	it("rejects item effects without explicit polarity", () => {
		const config: any = createValidConfigValue();
		config.items["item:twig"].effects = [
			{
				grants: [
					{
						id: "grant:test",
						name: "Test",
					},
				],
				id: "effect:test",
				name: "Test Grant",
			},
		];

		expect(() => parseGameConfig(config)).toThrow(/polarity/);
	});

	it("rejects duplicate grant ids across embedded effect sources", () => {
		const config: any = createValidConfigValue();
		addTestGrantSource(config, {
			effectId: "effect:first",
			grantId: "grant:shared",
		});
		config.items["item:plank"].effects = [
			createTestEffect({
				effectId: "effect:second",
				grantId: "grant:shared",
			}),
		];

		expect(() => parseGameConfig(config)).toThrow(/Duplicate grant id.*grant:shared/);
	});

	it("rejects malformed output-owned extra output chance effects", () => {
		const config: any = createValidConfigValue();
		addTestGrantSource(config, {
			polarity: "buff",
		});
		readTestLine(config, "line:test").output[0].effects = [
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

		expect(() => parseGameConfig(config)).toThrow(/Unrecognized key/);
	});

	it("rejects output-owned modifier effects that would be runtime no-ops", () => {
		const config: any = createValidConfigValue();
		addTestGrantSource(config, {
			polarity: "buff",
		});
		readTestLine(config, "line:test").output[0].effects = [
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

		readTestLine(config, "line:test").output[0].effects = [
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
		addTestGrantSource(config, {
			polarity: "buff",
		});
		readTestLine(config, "line:test").output[0].effects = [
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
		readTestLine(config, "line:test").output[0].effects = [
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
		readTestCraft(config, "item:craft-target").effects = [
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

		expect(() => parseGameConfig(config)).toThrow(/producer output effect/);
	});

	it("rejects craft visibility requirements because craft targets have no line visibility", () => {
		const config: any = createValidConfigValue();
		addTestGrantSource(config, {
			polarity: "neutral",
		});
		readTestCraft(config, "item:craft-target").effects = [
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

	it("allows non-consumed craft inputs for reusable tools", () => {
		const config = createValidConfigValue();
		readTestCraft(config, "item:craft-target").inputs[0] = {
			...readTestCraft(config, "item:craft-target").inputs[0],
			consume: false,
		};

		expect(() => parseGameConfig(config)).not.toThrow();
	});

	it("rejects blueprint craft recipes that require their own target", () => {
		const config: any = createValidConfigValue();
		config.items["item:blueprint-house-t1"] = {
			assetIds: [
				"asset:item",
			],
			description: "House I Blueprint",
			maxStackSize: 1,
			name: "House I Blueprint",
			tags: [],
			tier: 0,
		};
		config.items["producer:house-t1"] = {
			assetIds: [
				"asset:item",
			],
			description: "House I",
			maxStackSize: 1,
			name: "House I",
			tags: [],
			tier: 1,
		};
		setTestCraft(config, "item:blueprint-house-t1", {
			durationMs: 1000,
			inputs: [
				{
					consume: true,
					itemId: "item:blueprint-house-t1",
					quantity: 1,
				},
			],
			resultItemId: "producer:house-t1",
		});

		expect(() => parseGameConfig(config)).toThrow(/House I Blueprint -> House I Blueprint/);
	});

	it("rejects indirect blueprint dependency cycles through crafted buildings", () => {
		const config: any = createValidConfigValue();
		config.items["item:blueprint-a"] = {
			assetIds: [
				"asset:item",
			],
			description: "Blueprint A",
			maxStackSize: 1,
			name: "Blueprint A",
			tags: [],
			tier: 0,
		};
		config.items["item:blueprint-b"] = {
			assetIds: [
				"asset:item",
			],
			description: "Blueprint B",
			maxStackSize: 1,
			name: "Blueprint B",
			tags: [],
			tier: 0,
		};
		config.items["producer:a"] = {
			assetIds: [
				"asset:item",
			],
			description: "A",
			maxStackSize: 1,
			name: "A",
			tags: [],
			tier: 1,
		};
		config.items["producer:b"] = {
			assetIds: [
				"asset:item",
			],
			description: "B",
			maxStackSize: 1,
			name: "B",
			tags: [],
			tier: 1,
		};
		setTestCraft(config, "item:blueprint-a", {
			durationMs: 1000,
			inputs: [
				{
					consume: true,
					itemId: "producer:b",
					quantity: 1,
				},
			],
			resultItemId: "producer:a",
		});
		setTestCraft(config, "item:blueprint-b", {
			durationMs: 1000,
			inputs: [
				{
					consume: true,
					itemId: "producer:a",
					quantity: 1,
				},
			],
			resultItemId: "producer:b",
		});

		expect(() => parseGameConfig(config)).toThrow(/Blueprint A -> Blueprint B -> Blueprint A/);
	});

	it("rejects blueprint lines that require the building they unlock", () => {
		const config: any = createValidConfigValue();
		config.items["item:blueprint-a"] = {
			assetIds: [
				"asset:item",
			],
			description: "Blueprint A",
			maxStackSize: 1,
			name: "Blueprint A",
			tags: [],
			tier: 0,
		};
		config.items["producer:a"] = {
			assetIds: [
				"asset:item",
			],
			description: "A",
			maxStackSize: 1,
			name: "A",
			tags: [],
			tier: 1,
		};
		setTestCraft(config, "item:blueprint-a", {
			durationMs: 1000,
			inputs: [
				{
					consume: true,
					itemId: "item:twig",
					quantity: 1,
				},
			],
			resultItemId: "producer:a",
		});
		setTestProducer(config, "producer:a", {
			maxQueueSize: 1,
			lines: [
				{
					durationMs: 1000,
					id: "line:producer-a:blueprint-a",
					name: "Blueprint A",
					output: [
						{
							itemId: "item:blueprint-a",
							type: "guaranteed",
						},
					],
					placement: "board_then_inventory",
				},
			],
		});

		expect(() => parseGameConfig(config)).toThrow(/Blueprint A -> Blueprint A/);
	});

	it("rejects producer progression that is cross-locked behind another future producer", () => {
		const config: any = createValidConfigValue();
		config.items["item:blueprint-a"] = {
			assetIds: [
				"asset:item",
			],
			description: "Blueprint A",
			maxStackSize: 1,
			name: "Blueprint A",
			tags: [
				"blueprint",
			],
			tier: 0,
		};
		config.items["item:blueprint-b"] = {
			assetIds: [
				"asset:item",
			],
			description: "Blueprint B",
			maxStackSize: 1,
			name: "Blueprint B",
			tags: [
				"blueprint",
			],
			tier: 0,
		};
		config.items["item:a-part"] = {
			assetIds: [
				"asset:item",
			],
			description: "Part A",
			maxStackSize: 1,
			name: "Part A",
			tags: [],
			tier: 1,
		};
		config.items["item:b-part"] = {
			assetIds: [
				"asset:item",
			],
			description: "Part B",
			maxStackSize: 1,
			name: "Part B",
			tags: [],
			tier: 1,
		};
		config.items["producer:a"] = {
			assetIds: [
				"asset:item",
			],
			description: "Producer A",
			maxStackSize: 1,
			name: "Producer A",
			tags: [
				"producer",
			],
			tier: 1,
		};
		config.items["producer:b"] = {
			assetIds: [
				"asset:item",
			],
			description: "Producer B",
			maxStackSize: 1,
			name: "Producer B",
			tags: [
				"producer",
			],
			tier: 1,
		};
		readTestProducer(config, "item:producer").lines.push(
			{
				durationMs: 1000,
				id: "line:blueprint-a",
				name: "Blueprint A",
				output: [
					{
						itemId: "item:blueprint-a",
						type: "guaranteed",
					},
				],
				placement: "board_then_inventory",
			},
			{
				durationMs: 1000,
				id: "line:blueprint-b",
				name: "Blueprint B",
				output: [
					{
						itemId: "item:blueprint-b",
						type: "guaranteed",
					},
				],
				placement: "board_then_inventory",
			},
		);
		setTestCraft(config, "item:blueprint-a", {
			durationMs: 1000,
			inputs: [
				{
					consume: true,
					itemId: "item:b-part",
					quantity: 1,
				},
			],
			resultItemId: "producer:a",
		});
		setTestCraft(config, "item:blueprint-b", {
			durationMs: 1000,
			inputs: [
				{
					consume: true,
					itemId: "item:a-part",
					quantity: 1,
				},
			],
			resultItemId: "producer:b",
		});
		setTestProducer(config, "producer:a", {
			maxQueueSize: 1,
			lines: [
				{
					durationMs: 1000,
					id: "line:a-part",
					name: "Part A",
					output: [
						{
							itemId: "item:a-part",
							type: "guaranteed",
						},
					],
					placement: "board_then_inventory",
				},
			],
		});
		setTestProducer(config, "producer:b", {
			maxQueueSize: 1,
			lines: [
				{
					durationMs: 1000,
					id: "line:b-part",
					name: "Part B",
					output: [
						{
							itemId: "item:b-part",
							type: "guaranteed",
						},
					],
					placement: "board_then_inventory",
				},
			],
		});

		expect(() => parseGameConfig(config)).toThrow(/Soft-lock risk.*producer:a.*item:b-part/s);
	});

	it("rejects progression grant requirements that no item or line can provide", () => {
		const config: any = createValidConfigValue();
		config.items["item:producer"].tags = [
			"producer",
		];
		readTestLine(config, "line:test").output[0].effects = [
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

	it("rejects output effects that require and block the same grant", () => {
		const config: any = createValidConfigValue();
		config.items["item:producer"].tags = [
			"producer",
		];
		addTestGrantSource(config);
		config.items["item:twig"].effects = [
			createTestEffect(),
		];
		readTestLine(config, "line:test").output[0].effects = [
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

	it("rejects line-owned nearby capacity spend that only matches inventory-only items", () => {
		const config: any = createValidConfigValue();
		config.items["item:producer"].tags = [
			"producer",
		];
		config.items["item:twig"].storage = "inventory";
		readTestLine(config, "line:test").effects = [
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
				kind: "nearby.capacity.spend",
				radius: 1,
			},
		];

		expect(() => parseGameConfig(config)).toThrow(
			/nearby\.capacity\.spend.*matches no board-placeable item/,
		);
	});

	it("rejects progression that is gated behind an unreachable line-owned capacity deposit", () => {
		const config: any = createValidConfigValue();
		config.items["item:rare-deposit"] = {
			assetIds: [
				"asset:item",
			],
			description: "Rare Deposit",
			maxStackSize: 1,
			name: "Rare Deposit",
			storage: "board",
			tags: [],
			tier: 1,
		};
		addReachabilityTargetProducer(config);
		appendTestLine(config, "item:producer", {
			durationMs: 1000,
			effects: [
				{
					display: "always",
					items: {
						anyOf: [
							{
								ids: [
									"item:rare-deposit",
								],
							},
						],
					},
					kind: "nearby.capacity.spend",
					radius: 1,
				},
			],
			id: "line:gated-future",
			name: "Gated Future",
			output: [
				{
					itemId: "producer:future",
					type: "guaranteed",
				},
			],
			placement: "board_then_inventory",
		});

		expect(() => parseGameConfig(config)).toThrow(
			/Soft-lock risk.*producer:future.*item:rare-deposit/s,
		);
	});

	it("rejects nearby requirements that only match inventory-only items", () => {
		const config: any = createValidConfigValue();
		config.items["item:producer"].tags = [
			"producer",
		];
		config.items["item:twig"].storage = "inventory";
		readTestLine(config, "line:test").output[0].effects = [
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

	it("does not treat permanently hidden outputs as reachable progression", () => {
		const config: any = createValidConfigValue();
		addReachabilityTargetProducer(config);
		appendTestLine(config, "item:producer", {
			durationMs: 1000,
			id: "line:hidden-future",
			name: "Hidden Future",
			output: [
				{
					itemId: "producer:future",
					type: "guaranteed",
					visibility: "hidden",
				},
			],
			placement: "board_then_inventory",
		});

		expect(() => parseGameConfig(config)).toThrow(
			/Soft-lock risk.*producer:future.*No starting entry/s,
		);
	});

	it("allows hidden progression outputs when a reachable show grant can reveal them", () => {
		const config: any = createValidConfigValue();
		addTestGrantSource(config);
		addReachabilityTargetProducer(config);
		appendTestLine(config, "item:producer", {
			durationMs: 1000,
			id: "line:hidden-future",
			name: "Hidden Future",
			output: [
				{
					effects: [
						{
							display: "whenActive",
							kind: "grant.drop.show",
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
					],
					itemId: "producer:future",
					type: "guaranteed",
					visibility: "hidden",
				},
			],
			placement: "board_then_inventory",
		});

		expect(() => parseGameConfig(config)).not.toThrow();
	});

	it("does not treat permanently disabled outputs as reachable progression", () => {
		const config: any = createValidConfigValue();
		addReachabilityTargetProducer(config);
		appendTestLine(config, "item:producer", {
			durationMs: 1000,
			id: "line:disabled-future",
			name: "Disabled Future",
			output: [
				{
					enabled: false,
					itemId: "producer:future",
					type: "guaranteed",
				},
			],
			placement: "board_then_inventory",
		});

		expect(() => parseGameConfig(config)).toThrow(
			/Soft-lock risk.*producer:future.*No starting entry/s,
		);
	});

	it("allows disabled progression outputs when a reachable grant can enable them", () => {
		const config: any = createValidConfigValue();
		addTestGrantSource(config);
		addReachabilityTargetProducer(config);
		appendTestLine(config, "item:producer", {
			durationMs: 1000,
			id: "line:disabled-future",
			name: "Disabled Future",
			output: [
				{
					effects: [
						{
							display: "whenActive",
							kind: "grant.drop.enable",
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
					],
					enabled: false,
					itemId: "producer:future",
					type: "guaranteed",
				},
			],
			placement: "board_then_inventory",
		});

		expect(() => parseGameConfig(config)).not.toThrow();
	});

	it("keeps structural checks for queue size and non-empty inline output", () => {
		const config = createValidConfigValue();
		readTestProducer(config, "item:producer").maxQueueSize = 0;
		readTestLine(config, "line:test").output = [];

		expect(() => parseGameConfig(config)).toThrow(/Too small/);
	});
	it("allows quest craft targets with modest non-blueprint rewards", () => {
		const config: any = createValidConfigValue();
		config.items["item:quest:test"] = {
			assetIds: [
				"asset:item",
			],
			craft: {
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
			description: "Quest",
			maxStackSize: 1,
			name: "Quest",
			storage: "both",
			tags: [
				"quest",
				"craft-target",
			],
			tier: 0,
		};

		expect(() => parseGameConfig(config)).not.toThrow();
	});

	it("rejects quest rewards that hand out blueprints", () => {
		const config: any = createValidConfigValue();
		config.items["item:blueprint-test"] = {
			assetIds: [
				"asset:item",
			],
			description: "Blueprint",
			maxStackSize: 1,
			name: "Blueprint",
			tags: [
				"blueprint",
			],
			tier: 0,
		};
		config.items["item:quest:test"] = {
			assetIds: [
				"asset:item",
			],
			craft: {
				durationMs: 1000,
				inputs: [
					{
						consume: true,
						itemId: "item:twig",
						quantity: 1,
					},
				],
				resultItemId: "item:blueprint-test",
			},
			description: "Quest",
			maxStackSize: 1,
			name: "Quest",
			storage: "both",
			tags: [
				"quest",
				"craft-target",
			],
			tier: 0,
		};

		expect(() => parseGameConfig(config)).toThrow(/must not reward blueprint/);
	});

	it("rejects quests that take the same item they reward", () => {
		const config: any = createValidConfigValue();
		config.items["item:quest:test"] = {
			assetIds: [
				"asset:item",
			],
			craft: {
				durationMs: 1000,
				inputs: [
					{
						consume: true,
						itemId: "item:twig",
						quantity: 1,
					},
				],
				resultItemId: "item:twig",
			},
			description: "Quest",
			maxStackSize: 1,
			name: "Quest",
			storage: "both",
			tags: [
				"quest",
				"craft-target",
			],
			tier: 0,
		};

		expect(() => parseGameConfig(config)).toThrow(/must not take the same item/);
	});
});
