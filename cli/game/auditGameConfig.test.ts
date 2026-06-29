import { describe, expect, it } from "vitest";
import { parseGameConfig } from "../../src/v0/game/config/GameConfigSchema";
import { auditGameConfig, formatGameConfigAuditWarnings } from "./auditGameConfig";

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
			assetId: "asset:item",
			description: "Producer",
			maxStackSize: 1,
			name: "Producer",
			tags: [],
			tier: 0,
		},
		"item:fuel": {
			assetId: "asset:item",
			description: "Fuel",
			maxStackSize: 10,
			name: "Fuel",
			tags: [],
			tier: 0,
		},
		"item:pollution": {
			assetId: "asset:item",
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
	merge: {},
	producers: {
		"item:producer": {
			maxQueueSize: 1,
			productIds: [
				"product:test",
			],
		},
	},
	stashes: {},
	craftRecipes: {},
	products: {
		"product:test": {
			durationMs: 1000,
			inputs: [
				{
					capacity: 1,
					consume: true,
					itemId: "item:fuel",
					quantity: 1,
				},
			],
			name: "Test product",
			output: [
				{
					itemId: "item:pollution",
					quantity: 1,
					type: "guaranteed",
				},
			],
			placement: "board_then_inventory",
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

	it("does not warn about produced items used as passive effect sources", () => {
		const config = createConfigValue();
		const warnings = auditGameConfig(
			parseGameConfig({
				...config,
				effects: {
					"effect:pollution-slow": {
						name: "Pollution slow",
						operations: [
							{
								durationFactor: 0.5,
								kind: "duration.proximityPenalty",
								target: {
									productLines: {
										anyOf: [
											{
												ids: [
													"product:test",
												],
											},
										],
									},
								},
							},
						],
						radius: 2,
						scope: "local",
					},
				},
				items: {
					...config.items,
					"item:pollution": {
						...config.items["item:pollution"],
						passiveEffectIds: [
							"effect:pollution-slow",
						],
					},
				},
			}),
		);

		expect(warnings).toEqual([]);
	});

	it("tracks product-owned inline inputs and outputs", () => {
		const config: any = createConfigValue();
		config.products["product:test"].inputs = [
			{
				capacity: 1,
				consume: true,
				itemId: "item:fuel",
				quantity: 1,
			},
		];
		config.products["product:test"].output = [
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
