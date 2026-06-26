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
			kind: "item",
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
	requirements: {},
	producers: {
		"item:producer": {
			maxQueueSize: 1,
			productIds: [
				"product:test",
			],
			requirementIds: [],
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
			requirementIds: [],
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

	it("warns about duplicate central definition shapes", () => {
		const config: any = createConfigValue();
		config.requirements = {
			"requirement:near-a": {
				distance: 1,
				itemIds: [
					"item:fuel",
				],
				type: "proximity",
			},
			"requirement:near-b": {
				distance: 1,
				itemIds: [
					"item:fuel",
				],
				type: "proximity",
			},
		};
		config.producers["item:producer"].requirementIds = [
			"requirement:near-a",
		];

		const warnings = auditGameConfig(parseGameConfig(config));

		expect(warnings).toContainEqual(
			expect.objectContaining({
				code: "duplicate-definition-shape",
				section: "requirements",
			}),
		);
	});

	it("does not warn about produced items used as hindrances", () => {
		const config = createConfigValue();
		const warnings = auditGameConfig(
			parseGameConfig({
				...config,
				products: {
					...config.products,
					"product:test": {
						...config.products["product:test"],
						hinderedBy: [
							{
								distance: 2,
								itemIds: [
									"item:pollution",
								],
								type: "proximity",
							},
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

	it("formats warnings for CLI output", () => {
		const warnings = auditGameConfig(parseGameConfig(createConfigValue()));

		expect(formatGameConfigAuditWarnings(warnings)).toContain("Game config warnings:");
		expect(formatGameConfigAuditWarnings(warnings)).toContain("item:pollution");
	});
});
