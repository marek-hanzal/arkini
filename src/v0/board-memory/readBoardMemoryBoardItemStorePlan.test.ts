import { describe, expect, it } from "vitest";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import { readBoardMemoryBoardItemStorePlan } from "~/board-memory/readBoardMemoryBoardItemStorePlan";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";

const createSave = (item: GameSaveBoardItem): GameSave => ({
	activeEffects: {},
	board: {
		items: {
			[item.id]: item,
		},
	},
	boardMemoryLayouts: {},
	cheats: {
		speedMode: "normal",
	},
	craftInputs: {},
	craftJobs: {},
	createdAtMs: 0,
	gameId: "game:test",
	inventory: {
		slots: [
			null,
		],
	},
	itemCapacities: {},
	itemSpawnJobs: {},
	lines: {},
	producerCharges: {},
	producerInputs: {},
	producerJobs: {},
	updatedAtMs: 0,
	version: 1,
});

const boardItem = (overrides: Partial<GameSaveBoardItem> = {}): GameSaveBoardItem => ({
	id: "board:item",
	itemId: "item:twig",
	x: 0,
	y: 0,
	...overrides,
});

describe("readBoardMemoryBoardItemStorePlan", () => {
	it("stores regular board items as stack copies", () => {
		const item = boardItem();
		const config = createEngineTestConfig();
		expect(
			readBoardMemoryBoardItemStorePlan({
				config,
				item,
				save: createSave(item),
			}),
		).toEqual({
			mode: "stack-copy",
			type: "store",
		});
	});

	it("preserves board memory instances", () => {
		const item = boardItem({
			itemId: boardMemoryItemId,
		});
		const config = createEngineTestConfig({
			items: {
				[boardMemoryItemId]: {
					assetIds: [
						"asset:test",
					],
					description: "Board Memory",
					maxStackSize: 1,
					name: "Board Memory",
					storage: "both",
					tags: [],
					tier: 0,
				},
			},
		});

		expect(
			readBoardMemoryBoardItemStorePlan({
				config,
				item,
				save: createSave(item),
			}),
		).toEqual({
			mode: "preserve-instance",
			type: "store",
		});
	});

	it("skips board-only items", () => {
		const item = boardItem({
			itemId: "item:rock",
		});
		const config = createEngineTestConfig({
			items: {
				"item:rock": {
					storage: "board",
				},
			},
		});

		expect(
			readBoardMemoryBoardItemStorePlan({
				config,
				item,
				save: createSave(item),
			}),
		).toEqual({
			reason: "inventory-storage-forbidden",
			type: "skip",
		});
	});

	it("skips producer-busy items", () => {
		const item = boardItem({
			itemId: "item:producer",
		});
		const save = createSave(item);
		save.producerJobs["job:test"] = {
			id: "job:test",
			itemInstanceId: item.id,
			lineId: "line:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};

		expect(
			readBoardMemoryBoardItemStorePlan({
				config: createEngineTestConfig(),
				item,
				save,
			}),
		).toEqual({
			reason: "busy",
			type: "skip",
		});
	});
});
