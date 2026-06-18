import { describe, expect, it, vi } from "vitest";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { RuntimeGameEngineAdapter } from "~/v0/game/engine/runtime/RuntimeGameEngineAdapter";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { connectGameRuntimeSavePersistence } from "~/v0/play/runtime/connectGameRuntimeSavePersistence";
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

describe("connectGameRuntimeSavePersistence", () => {
	it("debounces runtime save writes and persists the latest save", async () => {
		vi.useFakeTimers();
		const store = await createStore();
		const saved: GameSave[] = [];
		const persistence = connectGameRuntimeSavePersistence({
			debounceMs: 100,
			storage: {
				async save(save) {
					saved.push(save);
				},
			},
			store,
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
		await store.dispatch({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.move",
				x: 0,
				y: 0,
			},
			nowMs: 20,
		});

		expect(saved).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(100);
		await persistence.flush();

		expect(saved).toHaveLength(1);
		expect(saved[0]?.board.items["item-instance:1"]).toMatchObject({
			x: 0,
			y: 0,
		});

		await persistence.destroy();
		store.destroy();
		vi.useRealTimers();
	});

	it("flushes pending save on destroy", async () => {
		vi.useFakeTimers();
		const store = await createStore();
		const saved: GameSave[] = [];
		const persistence = connectGameRuntimeSavePersistence({
			debounceMs: 1000,
			storage: {
				async save(save) {
					saved.push(save);
				},
			},
			store,
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

		await persistence.destroy();
		expect(saved).toHaveLength(1);
		expect(saved[0]?.board.items["item-instance:1"]).toMatchObject({
			x: 1,
			y: 0,
		});

		store.destroy();
		vi.useRealTimers();
	});
});
