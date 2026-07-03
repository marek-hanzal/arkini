import { describe, expect, it } from "vitest";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { findBoardItem, runAction, runInitialSave } from "~/engine/applyGameActionFx.testSupport";

const createMemoryTestConfig = () => {
	const base = createEngineTestConfig();
	return createEngineTestConfig({
		game: {
			...base.game,
			board: {
				height: 2,
				width: 3,
			},
			inventory: {
				slots: 4,
			},
		},
		items: {
			[boardMemoryItemId]: {
				assetIds: [
					"asset:test",
				],
				description: "Board memory",
				maxCount: 2,
				maxStackSize: 1,
				name: "Board Memory",
				storage: "board",
				tags: [],
				tier: 0,
			},
			"item:producer": {
				storage: "both",
			},
		},
		startingState: {
			board: [
				{
					itemId: boardMemoryItemId,
					x: 0,
					y: 0,
				},
				{
					itemId: "item:producer",
					x: 1,
					y: 0,
				},
				{
					itemId: boardMemoryItemId,
					x: 2,
					y: 0,
				},
			],
			inventory: [],
		},
	});
};

describe("applyBoardMemoryActivateFx", () => {
	it("saves board layout on empty memory activation", () => {
		const config = createMemoryTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const memory = findBoardItem(save, {
			itemId: boardMemoryItemId,
			x: 0,
			y: 0,
		});
		expect(memory).toBeDefined();

		const result = runAction({
			action: {
				boardItemId: memory!.id,
				type: "board.memory.activate",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.boardMemoryLayouts[memory!.id]).toEqual({
			items: [
				{
					itemId: "item:producer",
					x: 1,
					y: 0,
				},
			],
			savedAtMs: 100,
		});
		expect(result.events).toContainEqual({
			atMs: 100,
			boardItemId: memory!.id,
			itemCount: 1,
			type: "board.memory.saved",
		});
	});

	it("restores saved positions through inventory and clears memory after full restore", () => {
		const config = createMemoryTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const memory = findBoardItem(save, {
			itemId: boardMemoryItemId,
			x: 0,
			y: 0,
		});
		expect(memory).toBeDefined();

		const saved = runAction({
			action: {
				boardItemId: memory!.id,
				type: "board.memory.activate",
			},
			config,
			nowMs: 100,
			save,
		}).save;
		const producer = findBoardItem(saved, {
			itemId: "item:producer",
			x: 1,
			y: 0,
		});
		expect(producer).toBeDefined();

		const moved = runAction({
			action: {
				boardItemId: producer!.id,
				type: "board.item.move",
				x: 2,
				y: 1,
			},
			config,
			nowMs: 200,
			save: saved,
		}).save;

		const restored = runAction({
			action: {
				boardItemId: memory!.id,
				type: "board.memory.activate",
			},
			config,
			nowMs: 300,
			save: moved,
		});

		expect(
			findBoardItem(restored.save, {
				itemId: "item:producer",
				x: 1,
				y: 0,
			}),
		).toBeDefined();
		expect(restored.save.boardMemoryLayouts[memory!.id]).toBeUndefined();
		expect(restored.events).toContainEqual({
			atMs: 300,
			boardItemId: memory!.id,
			restoredCount: 1,
			storedCount: 1,
			type: "board.memory.restored",
		});
	});

	it("keeps saved memory when restore cannot output every stored item", () => {
		const config = createMemoryTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const memory = findBoardItem(save, {
			itemId: boardMemoryItemId,
			x: 0,
			y: 0,
		});
		expect(memory).toBeDefined();

		const saved = runAction({
			action: {
				boardItemId: memory!.id,
				type: "board.memory.activate",
			},
			config,
			nowMs: 100,
			save,
		}).save;
		const producer = findBoardItem(saved, {
			itemId: "item:producer",
			x: 1,
			y: 0,
		});
		expect(producer).toBeDefined();

		const missingProducerSave = structuredClone(saved);
		delete missingProducerSave.board.items[producer!.id];

		const restored = runAction({
			action: {
				boardItemId: memory!.id,
				type: "board.memory.activate",
			},
			config,
			nowMs: 200,
			save: missingProducerSave,
		});

		expect(restored.save.boardMemoryLayouts[memory!.id]).toBeDefined();
		expect(restored.events).toContainEqual({
			atMs: 200,
			boardItemId: memory!.id,
			restoredCount: 0,
			storedCount: 1,
			type: "board.memory.restored",
		});
	});
});
