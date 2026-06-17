import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { RuntimeGameEngineAdapter } from "~/v0/game/engine/runtime/RuntimeGameEngineAdapter";
import { GameRuntimeStore } from "~/v0/play/runtime/GameRuntimeStore";

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
	it("publishes selected board and inventory views after dispatch", async () => {
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

		expect(calls).toBe(1);
		expect(store.getSnapshot().board.byId["item-instance:1"]).toMatchObject({
			x: 1,
			y: 0,
		});
		expect(store.getSnapshot().revision).toBe(1);

		unsubscribe();
		store.destroy();
	});
	it("publishes runtime updates with previous and current snapshots", async () => {
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
		expect(updates[0]?.previous.board.byId["item-instance:1"]).toMatchObject({
			x: 0,
			y: 0,
		});
		expect(updates[0]?.current.board.byId["item-instance:1"]).toMatchObject({
			x: 1,
			y: 0,
		});

		unsubscribe();
		store.destroy();
	});

});
