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
				maxStackSize: 1,
				name: "Board Memory",
				storage: "both",
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

		const otherMemory = findBoardItem(save, {
			itemId: boardMemoryItemId,
			x: 2,
			y: 0,
		});
		expect(otherMemory).toBeDefined();

		expect(result.save.boardMemoryLayouts[memory!.id]).toEqual({
			items: [
				{
					itemId: boardMemoryItemId,
					itemInstanceId: memory!.id,
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
					itemInstanceId: otherMemory!.id,
					x: 2,
					y: 0,
				},
			],
			savedAtMs: 100,
		});
		expect(result.events).toContainEqual({
			atMs: 100,
			boardItemId: memory!.id,
			itemCount: 3,
			type: "board.memory.saved",
		});
	});

	it("restores saved positions through inventory and clears memory after restore", () => {
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
		expect(
			findBoardItem(restored.save, {
				itemId: boardMemoryItemId,
				x: 0,
				y: 0,
			}),
		)?.toMatchObject({
			id: memory!.id,
		});
		expect(restored.events).toContainEqual({
			atMs: 300,
			boardItemId: memory!.id,
			restoredCount: 3,
			storedCount: 3,
			type: "board.memory.restored",
		});
	});

	it("clears saved memory when restore cannot output every stored item", () => {
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

		expect(restored.save.boardMemoryLayouts[memory!.id]).toBeUndefined();
		expect(restored.events).toContainEqual({
			atMs: 200,
			boardItemId: memory!.id,
			restoredCount: 2,
			storedCount: 3,
			type: "board.memory.restored",
		});
	});

	it("restores the activated memory item back to its saved board cell", () => {
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

		const moved = runAction({
			action: {
				boardItemId: memory!.id,
				type: "board.item.move",
				x: 0,
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

		expect(restored.save.board.items[memory!.id]).toMatchObject({
			itemId: boardMemoryItemId,
			x: 0,
			y: 0,
		});
	});

	it("can store filled memory in inventory as an instance without losing its layout", () => {
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

		const stashed = runAction({
			action: {
				boardItemId: memory!.id,
				type: "board.item.stash",
			},
			config,
			nowMs: 200,
			save: saved,
		}).save;

		expect(stashed.board.items[memory!.id]).toBeUndefined();
		expect(stashed.inventory.slots).toContainEqual({
			id: memory!.id,
			itemId: boardMemoryItemId,
			kind: "instance",
		});
		expect(stashed.boardMemoryLayouts[memory!.id]).toBeDefined();
	});
});
