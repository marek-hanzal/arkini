import { describe, expect, it } from "vitest";
import { parseGameConfig as parseGameConfigRaw } from "../../src/config/GameConfigSchema";
import { GAME_HERO_ASSET_ID } from "../../src/config/GameWellKnownAssetIds";
import { auditGameConfig, formatGameConfigAuditWarnings } from "./auditGameConfig";

const parseGameConfig = parseGameConfigRaw;

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

	it("formats warnings for CLI output", () => {
		const warnings = auditGameConfig(parseGameConfig(createConfigValue()));

		expect(formatGameConfigAuditWarnings(warnings)).toContain("Game config warnings:");
		expect(formatGameConfigAuditWarnings(warnings)).toContain("item:pollution");
	});
});
