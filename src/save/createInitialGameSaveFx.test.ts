import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { parseGameConfig, type GameConfig } from "~/config/GameConfigSchema";
import { createInitialGameSaveFx } from "~/save/createInitialGameSaveFx";

const createConfig = (overrides: Partial<GameConfig> = {}) =>
	parseGameConfig({
		version: 1,
		game: {
			id: "game:test",
			title: "Test",
			board: {
				width: 2,
				height: 2,
			},
			inventory: {
				slots: 3,
			},
		},
		resources: {
			"resource:test": {
				data: "x",
			},
		},
		assets: {
			"asset:test": {
				label: "Test",
				render: "plain",
				resourceId: "resource:test",
			},
		},
		items: {
			"item:producer": {
				assetIds: [
					"asset:test",
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
							name: "Test product",
							placement: "board_then_inventory",
						},
					],
				},
				tags: [],
				tier: 0,
			},
			"item:twig": {
				assetIds: [
					"asset:test",
				],
				description: "Twig",
				maxStackSize: 5,
				name: "Twig",
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
					quantity: 5,
				},
			],
		},
		...overrides,
	});

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));

describe("createInitialGameSaveFx", () => {
	it("bootstraps board item instances and inventory stacks from startingState", () => {
		const save = runInitialSave({
			config: createConfig(),
			nowMs: 100,
		});

		expect(save).toMatchObject({
			createdAtMs: 100,
			gameId: "game:test",
			updatedAtMs: 100,
			version: 1,
		});
		expect(Object.values(save.board.items)).toEqual([
			{
				id: "item-instance:1",
				itemId: "item:producer",
				x: 0,
				y: 0,
			},
		]);
		expect(save.inventory.slots).toEqual([
			{
				itemId: "item:twig",
				quantity: 5,
			},
			null,
			null,
		]);
	});

	it("rejects duplicate starting board cells through config validation", () => {
		expect(() =>
			createConfig({
				startingState: {
					board: [
						{
							itemId: "item:producer",
							x: 0,
							y: 0,
						},
						{
							itemId: "item:twig",
							x: 0,
							y: 0,
						},
					],
					inventory: [],
				},
			}),
		).toThrow(/Duplicate starting board cell/);
	});
});
