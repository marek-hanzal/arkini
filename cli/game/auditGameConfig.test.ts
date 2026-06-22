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
			code: "producer",
			description: "Producer",
			maxStackSize: 1,
			name: "Producer",
			producerId: "producer:test",
			tags: [],
			tier: 0,
		},
		"item:fuel": {
			assetId: "asset:item",
			code: "fuel",
			description: "Fuel",
			maxStackSize: 10,
			name: "Fuel",
			tags: [],
			tier: 0,
		},
		"item:pollution": {
			assetId: "asset:item",
			code: "pollution",
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
	inputs: {
		"input:test": {
			name: "Test input",
			inputs: [
				{
					capacity: 1,
					consume: true,
					itemId: "item:fuel",
					quantity: 1,
				},
			],
		},
	},
	requirements: {},
	producers: {
		"producer:test": {
			maxQueueSize: 1,
			productIds: [
				"product:test",
			],
			requirementIds: [],
			type: "producer",
		},
	},
	stashes: {},
	craftRecipes: {},
	products: {
		"product:test": {
			durationMs: 1000,
			inputRefId: "input:test",
			name: "Test product",
			outputTableId: "loot:test",
			placement: "board_then_inventory",
			requirementIds: [],
		},
	},
	lootTables: {
		"loot:test": {
			name: "Test loot",
			output: [
				{
					itemId: "item:pollution",
					quantity: 1,
					type: "guaranteed",
				},
			],
		},
	},
	upgrades: {},
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

	it("does not warn about produced items used as blockers", () => {
		const config = createConfigValue();
		const warnings = auditGameConfig(
			parseGameConfig({
				...config,
				products: {
					...config.products,
					"product:test": {
						...config.products["product:test"],
						blockedBy: [
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

	it("formats warnings for CLI output", () => {
		const warnings = auditGameConfig(parseGameConfig(createConfigValue()));

		expect(formatGameConfigAuditWarnings(warnings)).toContain("Game config warnings:");
		expect(formatGameConfigAuditWarnings(warnings)).toContain("item:pollution");
	});
});
