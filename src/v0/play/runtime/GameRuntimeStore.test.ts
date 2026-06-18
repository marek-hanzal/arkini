import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { RuntimeGameEngineAdapter } from "~/v0/game/engine/runtime/RuntimeGameEngineAdapter";
import { GameRuntimeStore } from "~/v0/play/runtime/GameRuntimeStore";
import { readGameRuntimeBoardView } from "~/v0/play/runtime/readGameRuntimeViews";

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

		const board = readGameRuntimeBoardView(store.getSnapshot());

		expect(calls).toBe(1);
		expect(board.byId["item-instance:1"]).toMatchObject({
			x: 1,
			y: 0,
		});
		expect(store.getSnapshot().revision).toBe(1);

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
		expect(
			readGameRuntimeBoardView(updates[0]!.previous).byId["item-instance:1"],
		).toMatchObject({
			x: 0,
			y: 0,
		});
		expect(readGameRuntimeBoardView(updates[0]!.current).byId["item-instance:1"]).toMatchObject(
			{
				x: 1,
				y: 0,
			},
		);

		unsubscribe();
		store.destroy();
	});
});
