import { describe, expect, it } from "vitest";
import { parseGameConfig } from "../../src/config/GameConfigSchema";
import { GAME_HERO_ASSET_ID } from "../../src/config/GameWellKnownAssetIds";
import {
	auditGameConfig,
	auditGameConfigReport,
	formatGameConfigAuditReport,
	formatGameConfigAuditWarnings,
} from "./auditGameConfig";

const createConfigValue = () => ({
	version: 1,
	game: {
		id: "game:test",
		title: "Test",
		board: {
			width: 2,
			height: 2,
		},
		inventory: {
			slots: 4,
		},
	},
	resources: {
		"resource:item": {
			data: "iVBOR-item",
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
								capacity: 1,
								consume: true,
								itemId: "item:fuel",
								quantity: 1,
							},
						],
						name: "Test line",
						output: [
							{
								itemId: "item:pollution",
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
		"item:fuel": {
			assetIds: [
				"asset:item",
			],
			description: "Fuel",
			maxStackSize: 10,
			name: "Fuel",
			tags: [],
			tier: 0,
		},
		"item:pollution": {
			assetIds: [
				"asset:item",
			],
			description: "Pollution",
			maxStackSize: 1,
			name: "Pollution",
			storage: "board",
			tags: [
				"danger",
			],
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
				itemId: "item:fuel",
				quantity: 1,
			},
		],
	},
});

const readTestLine = (config: ReturnType<typeof createConfigValue>, lineId: string) => {
	const line = config.items["item:producer"].producer.lines.find((line) => line.id === lineId);
	if (!line) throw new Error(`Missing test line "${lineId}".`);
	return line as any;
};

const addLimitedDepositItem = (
	config: ReturnType<typeof createConfigValue>,
	itemId: string,
	options: {
		max?: number;
		tags?: string[];
	} = {},
) => {
	(config.items as any)[itemId] = {
		assetIds: [
			"asset:item",
		],
		capacity: {
			max: options.max ?? 3,
			onDepleted: "remove",
		},
		description: `Limited test deposit ${itemId}.`,
		maxStackSize: 1,
		name: itemId,
		tags: options.tags ?? [
			"source",
		],
		tier: 0,
	};
};

const createCapacitySpendEffect = (itemIds: readonly string[]) => ({
	amount: 1,
	display: "always",
	items: {
		anyOf: [
			{
				ids: itemIds,
			},
		],
	},
	kind: "nearby.capacity.spend",
	radius: 2,
});

describe("auditGameConfig", () => {
	it("warns about produced items with no downstream use", () => {
		const warnings = auditGameConfig(parseGameConfig(createConfigValue()));

		expect(warnings).toEqual([
			expect.objectContaining({
				code: "terminal-item",
				id: "item:pollution",
			}),
		]);
	});

	it("tracks line-owned inline inputs and outputs", () => {
		const config: any = createConfigValue();
		readTestLine(config, "line:test").inputs = [
			{
				capacity: 1,
				consume: true,
				itemId: "item:fuel",
				quantity: 1,
			},
		];
		readTestLine(config, "line:test").output = [
			{
				itemId: "item:pollution",
				quantity: 1,
				type: "guaranteed",
			},
		];

		const warnings = auditGameConfig(parseGameConfig(config));

		expect(warnings).toEqual([
			expect.objectContaining({
				code: "terminal-item",
				id: "item:pollution",
			}),
		]);
	});

	it("does not call produced items terminal when output-owned effects reference them", () => {
		const config: any = createConfigValue();
		readTestLine(config, "line:test").output[0].effects = [
			{
				bands: [
					{
						minDistance: 0,
						multiplier: 2,
					},
				],
				display: "whenActive",
				items: {
					anyOf: [
						{
							ids: [
								"item:pollution",
							],
						},
					],
				},
				kind: "nearby.duration.multiply",
				radius: 1,
			},
		];

		const warnings = auditGameConfig(parseGameConfig(config));

		expect(warnings).not.toContainEqual(
			expect.objectContaining({
				code: "terminal-item",
				id: "item:pollution",
			}),
		);
	});

	it("warns about unused asset definitions", () => {
		const config: any = createConfigValue();
		config.resources["resource:unused"] = {
			data: "iVBOR-unused",
		};
		config.assets["asset:unused"] = {
			label: "Unused",
			render: "plain",
			resourceId: "resource:unused",
		};

		const warnings = auditGameConfig(parseGameConfig(config));

		expect(warnings).toContainEqual(
			expect.objectContaining({
				code: "unused-definition",
				id: "asset:unused",
				section: "assets",
			}),
		);
	});

	it("treats well-known game assets as used by app surfaces", () => {
		const config: any = createConfigValue();
		config.resources["resource:hero"] = {
			data: "iVBOR-hero",
		};
		config.assets[GAME_HERO_ASSET_ID] = {
			label: "Hero",
			render: "plain",
			resourceId: "resource:hero",
		};

		const warnings = auditGameConfig(parseGameConfig(config));

		expect(warnings).not.toContainEqual(
			expect.objectContaining({
				code: "unused-definition",
				id: GAME_HERO_ASSET_ID,
				section: "assets",
			}),
		);
	});

	it("warns about PNG resources that no asset references", () => {
		const config: any = createConfigValue();
		config.resources["resource:orphan-png"] = {
			data: "iVBOR-orphan",
		};

		const warnings = auditGameConfig(parseGameConfig(config));

		expect(warnings).toContainEqual(
			expect.objectContaining({
				code: "unused-definition",
				id: "resource:orphan-png",
				section: "resources",
			}),
		);
	});

	it("does not warn about overlay assets referenced by used assets", () => {
		const config: any = createConfigValue();
		config.resources["resource:overlay"] = {
			data: "iVBOR-overlay",
		};
		config.assets["asset:item"].overlayAssetId = "asset:overlay";
		config.assets["asset:overlay"] = {
			label: "Overlay",
			render: "plain",
			resourceId: "resource:overlay",
		};

		const warnings = auditGameConfig(parseGameConfig(config));

		expect(warnings).not.toContainEqual(
			expect.objectContaining({
				code: "unused-definition",
				id: "asset:overlay",
				section: "assets",
			}),
		);
	});

	it("warns about limited deposits with no sustainable replacement path", () => {
		const config: any = createConfigValue();
		addLimitedDepositItem(config, "item:deposit");
		readTestLine(config, "line:test").effects = [
			createCapacitySpendEffect([
				"item:deposit",
			]),
		];

		const warnings = auditGameConfig(parseGameConfig(config));

		expect(warnings).toContainEqual(
			expect.objectContaining({
				code: "limited-deposit-softlock",
				id: "item:deposit",
			}),
		);
	});

	it("warns when finite capacity is spent by stochastic-only output lines", () => {
		const config: any = createConfigValue();
		addLimitedDepositItem(config, "item:deposit");
		readTestLine(config, "line:test").effects = [
			createCapacitySpendEffect([
				"item:deposit",
			]),
		];
		readTestLine(config, "line:test").output = [
			{
				chance: 0.5,
				itemId: "item:pollution",
				type: "chance",
			},
		];

		const warnings = auditGameConfig(parseGameConfig(config));

		expect(warnings).toContainEqual(
			expect.objectContaining({
				code: "limited-deposit-stochastic-softlock",
				id: "item:deposit",
			}),
		);
	});

	it("does not warn about stochastic capacity spend lines that also have guaranteed output", () => {
		const config: any = createConfigValue();
		addLimitedDepositItem(config, "item:deposit");
		readTestLine(config, "line:test").effects = [
			createCapacitySpendEffect([
				"item:deposit",
			]),
		];
		readTestLine(config, "line:test").output = [
			{
				itemId: "item:pollution",
				type: "guaranteed",
			},
			{
				chance: 0.5,
				itemId: "item:pollution",
				type: "chance",
			},
		];

		const warnings = auditGameConfig(parseGameConfig(config));

		expect(warnings).not.toContainEqual(
			expect.objectContaining({
				code: "limited-deposit-stochastic-softlock",
				id: "item:deposit",
			}),
		);
	});

	it("does not warn about limited deposits that can be produced sustainably", () => {
		const config: any = createConfigValue();
		addLimitedDepositItem(config, "item:deposit");
		config.items["item:nursery"] = {
			assetIds: [
				"asset:item",
			],
			description: "Renewable deposit producer",
			maxStackSize: 1,
			name: "Nursery",
			producer: {
				lines: [
					{
						durationMs: 1000,
						id: "line:nursery:deposit",
						name: "Grow deposit",
						output: [
							{
								itemId: "item:deposit",
								type: "guaranteed",
							},
						],
					},
				],
			},
			tags: [],
			tier: 0,
		};
		readTestLine(config, "line:test").effects = [
			createCapacitySpendEffect([
				"item:deposit",
			]),
		];

		const warnings = auditGameConfig(parseGameConfig(config));

		expect(warnings).not.toContainEqual(
			expect.objectContaining({
				code: "limited-deposit-softlock",
				id: "item:deposit",
			}),
		);
	});

	it("does not treat finite deposit growth loops as sustainable replacement paths", () => {
		const config: any = createConfigValue();
		addLimitedDepositItem(config, "item:tree", {
			tags: [
				"wood-source",
			],
		});
		addLimitedDepositItem(config, "item:forest", {
			max: 6,
			tags: [
				"wood-source",
			],
		});
		config.items["item:seed"] = {
			assetIds: [
				"asset:item",
			],
			craft: {
				durationMs: 1000,
				inputs: [
					{
						consume: true,
						itemId: "item:fuel",
					},
				],
				resultItemId: "item:tree",
			},
			description: "Seed grown from forest",
			maxStackSize: 10,
			name: "Seed",
			tags: [],
			tier: 0,
		};
		config.items["item:fuel"].merges = [
			{
				output: [
					{
						itemId: "item:seed",
						type: "guaranteed",
					},
				],
				targetMode: "keep",
				withItemId: "item:forest",
			},
		];
		readTestLine(config, "line:test").effects = [
			createCapacitySpendEffect([
				"item:tree",
				"item:forest",
			]),
		];

		const warnings = auditGameConfig(parseGameConfig(config));

		expect(warnings).toContainEqual(
			expect.objectContaining({
				code: "limited-deposit-softlock",
				id: "item:tree",
			}),
		);
		expect(warnings).toContainEqual(
			expect.objectContaining({
				code: "limited-deposit-softlock",
				id: "item:forest",
			}),
		);
	});

	it("does not warn about finite deposits that deplete into a sustainable regrowth item", () => {
		const config: any = createConfigValue();
		addLimitedDepositItem(config, "item:tree", {
			tags: [
				"wood-source",
			],
		});
		addLimitedDepositItem(config, "item:double-tree", {
			tags: [
				"wood-source",
			],
		});
		addLimitedDepositItem(config, "item:micro-forest", {
			tags: [
				"wood-source",
			],
		});
		config.items["item:tree"].capacity = {
			max: 3,
			onDepleted: "replace",
			replaceItemId: "item:seed",
		};
		config.items["item:double-tree"].capacity = {
			max: 6,
			onDepleted: "replace",
			replaceItemId: "item:seed",
		};
		config.items["item:micro-forest"].capacity = {
			max: 9,
			onDepleted: "replace",
			replaceItemId: "item:seed",
		};
		config.items["item:seed"] = {
			assetIds: [
				"asset:item",
			],
			craft: {
				durationMs: 1000,
				inputs: [
					{
						consume: true,
						itemId: "item:water",
					},
				],
				resultItemId: "item:tree",
			},
			description: "Seed grown from water",
			maxStackSize: 10,
			name: "Seed",
			tags: [],
			tier: 0,
		};
		config.items["item:water"] = {
			assetIds: [
				"asset:item",
			],
			description: "Sustainable water",
			maxStackSize: 10,
			merges: [
				{
					resultItemId: "item:double-tree",
					withItemId: "item:tree",
				},
				{
					resultItemId: "item:micro-forest",
					withItemId: "item:double-tree",
				},
			],
			name: "Water",
			tags: [],
			tier: 0,
		};
		config.items["item:well"] = {
			assetIds: [
				"asset:item",
			],
			description: "Water source",
			maxStackSize: 1,
			name: "Well",
			producer: {
				lines: [
					{
						durationMs: 1000,
						id: "line:well:water",
						name: "Water",
						output: [
							{
								itemId: "item:water",
								type: "guaranteed",
							},
						],
					},
				],
			},
			tags: [],
			tier: 0,
		};
		readTestLine(config, "line:test").effects = [
			createCapacitySpendEffect([
				"item:tree",
				"item:double-tree",
				"item:micro-forest",
			]),
		];

		const warnings = auditGameConfig(parseGameConfig(config));

		expect(warnings).not.toContainEqual(
			expect.objectContaining({
				code: "limited-deposit-softlock",
				id: "item:tree",
			}),
		);
		expect(warnings).not.toContainEqual(
			expect.objectContaining({
				code: "limited-deposit-softlock",
				id: "item:double-tree",
			}),
		);
		expect(warnings).not.toContainEqual(
			expect.objectContaining({
				code: "limited-deposit-softlock",
				id: "item:micro-forest",
			}),
		);
	});

	it("formats a verbose config audit report", () => {
		const config: any = createConfigValue();
		addLimitedDepositItem(config, "item:deposit");
		readTestLine(config, "line:test").effects = [
			createCapacitySpendEffect([
				"item:deposit",
			]),
		];
		readTestLine(config, "line:test").output = [
			{
				chance: 0.5,
				itemId: "item:pollution",
				type: "chance",
			},
		];

		const reportText = formatGameConfigAuditReport(
			auditGameConfigReport(parseGameConfig(config)),
		);

		expect(reportText).toContain("Game config report:");
		expect(reportText).toContain("limited deposits: 1");
		expect(reportText).toContain("item:deposit: max 3, onDepleted remove");
		expect(reportText).toContain("RNG risk lines: item:producer.line:test");
		expect(reportText).toContain("limited-deposit-stochastic-softlock");
	});

	it("formats warnings for CLI output", () => {
		const warnings = auditGameConfig(parseGameConfig(createConfigValue()));

		expect(formatGameConfigAuditWarnings(warnings)).toContain("Game config warnings:");
		expect(formatGameConfigAuditWarnings(warnings)).toContain("item:pollution");
	});
});
