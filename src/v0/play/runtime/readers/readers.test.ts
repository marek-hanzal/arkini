import { describe, expect, it } from "vitest";
import { RuntimeGameEngineAdapter } from "~/v0/game/engine/runtime/RuntimeGameEngineAdapter";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import type { GameRuntimeState } from "~/v0/play/runtime/GameRuntimeStore";
import {
	readBoardFirstEmptyCell,
	readBoardItem,
	readBoardView,
	readInventorySlot,
} from "~/v0/play/runtime/readers";

const createRuntimeState = async (): Promise<GameRuntimeState> => {
	const adapter = await RuntimeGameEngineAdapter.create({
		config: createEngineTestConfig(),
		nowMs: 0,
	});

	return {
		nowMs: 0,
		revision: 0,
		runtime: adapter.readSnapshot(),
	};
};

describe("runtime readers", () => {
	it("reads one board item without rebuilding the whole board view", async () => {
		const state = await createRuntimeState();
		const item = readBoardItem({
			boardItemId: "item-instance:1",
			state,
		});

		expect(item).toEqual(readBoardView(state).byId["item-instance:1"]);
	});

	it("can rebuild the board view against an explicit clock instead of snapshot time", async () => {
		const state = await createRuntimeState();
		state.runtime.save.producerJobs["producer-job:1"] = {
			id: "producer-job:1",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};

		expect(
			readBoardView(state).byId["item-instance:1"]?.activation?.productLines?.[0]?.progress,
		).toBe(0);
		expect(
			readBoardView(state, 500).byId["item-instance:1"]?.activation?.productLines?.[0]
				?.progress,
		).toBe(0.5);
	});

	it("reads the first empty board cell from raw save coordinates and config dimensions", async () => {
		const state = await createRuntimeState();

		expect(readBoardFirstEmptyCell(state)).toEqual({
			x: 1,
			y: 0,
		});

		state.runtime.save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		};

		expect(readBoardFirstEmptyCell(state)).toBeUndefined();
	});

	it("reads one inventory slot without deriving the whole inventory view", async () => {
		const state = await createRuntimeState();
		state.runtime.save.inventory.slots[1] = {
			itemId: "item:twig",
			quantity: 2,
		};

		expect(
			readInventorySlot({
				slotIndex: 1,
				state,
			}),
		).toMatchObject({
			slotIndex: 1,
			stack: {
				id: "runtime:inventory:1:item:twig",
				itemId: "item:twig",
				quantity: 2,
			},
		});
	});
});
