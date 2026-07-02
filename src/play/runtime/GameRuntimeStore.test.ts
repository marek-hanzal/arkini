import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { RuntimeGameEngineAdapter } from "~/engine/runtime/RuntimeGameEngineAdapter";
import { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";
import { readBoardView } from "~/play/runtime/readers";
import {
	readBoardTransientTiles,
	upsertBoardTransientTiles,
} from "~/board/animation/BoardTransientTileStore";
import { readTileEngineMotionRequests, registerTileEngineMotionRequests } from "~/tile-engine";

const createStore = async () => {
	const config = createEngineTestConfig();
	return GameRuntimeStore.create({
		adapter: await RuntimeGameEngineAdapter.create({
			config,
			nowMs: 0,
		}),
		nowMs: 0,
	});
};

describe("GameRuntimeStore", () => {
	it("publishes raw runtime snapshots after dispatch", async () => {
		const store = await createStore();
		let calls = 0;
		const unsubscribe = store.subscribe(() => {
			calls += 1;
		});

		await store.dispatch({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.move",
				x: 1,
				y: 0,
			},
			nowMs: 10,
		});

		const board = readBoardView(store.getSnapshot());

		expect(calls).toBe(1);
		expect(board.byId["item-instance:1"]).toMatchObject({
			x: 1,
			y: 0,
		});
		expect(store.getSnapshot().revision).toBe(1);
		expect(store.getSnapshot().nowMs).toBe(10);

		unsubscribe();
		store.destroy();
	});
	it("publishes runtime updates with previous and current raw snapshots", async () => {
		const store = await createStore();
		const updates: GameRuntimeStore.Update[] = [];
		const unsubscribe = store.subscribeUpdate((update) => {
			updates.push(update);
		});

		await store.dispatch({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.move",
				x: 1,
				y: 0,
			},
			nowMs: 10,
		});

		expect(updates).toHaveLength(1);
		expect(readBoardView(updates[0]!.previous).byId["item-instance:1"]).toMatchObject({
			x: 0,
			y: 0,
		});
		expect(readBoardView(updates[0]!.current).byId["item-instance:1"]).toMatchObject({
			x: 1,
			y: 0,
		});
		expect(updates[0]!.current.nowMs).toBe(10);

		unsubscribe();
		store.destroy();
	});

	it("clears transient visual stores on save replacement", async () => {
		const store = await createStore();
		upsertBoardTransientTiles([
			{
				groupId: "group:test",
				id: "transient:test",
				itemId: "item:twig",
				slotId: "slot:test",
			},
		]);
		registerTileEngineMotionRequests({
			engineId: "board",
			requests: [
				{
					feedback: {
						groupId: "group:test",
						kind: "bounce",
					},
					tileId: "item-instance:1",
				},
			],
		});

		await store.replaceSave({
			nowMs: 10,
			save: store.adapter.readSave(),
		});

		expect(readBoardTransientTiles()).toEqual([]);
		expect(readTileEngineMotionRequests("board").size).toBe(0);
		store.destroy();
	});

	it("clears transient visual stores on destroy", async () => {
		const store = await createStore();
		upsertBoardTransientTiles([
			{
				groupId: "group:test",
				id: "transient:test",
				itemId: "item:twig",
				slotId: "slot:test",
			},
		]);
		registerTileEngineMotionRequests({
			engineId: "board",
			requests: [
				{
					enter: {
						groupId: "group:test",
						kind: "pop-in",
					},
					tileId: "item-instance:1",
				},
			],
		});

		store.destroy();

		expect(readBoardTransientTiles()).toEqual([]);
		expect(readTileEngineMotionRequests("board").size).toBe(0);
	});
});
