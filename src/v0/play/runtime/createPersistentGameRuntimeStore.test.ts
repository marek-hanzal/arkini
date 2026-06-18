import { describe, expect, it } from "vitest";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { RuntimeGameEngineAdapter } from "~/v0/game/engine/runtime/RuntimeGameEngineAdapter";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import type {
	DeleteActiveGameSaveProps,
	GameSaveStorage,
	GameSaveStorageScope,
	SaveActiveGameSaveProps,
} from "~/v0/game/storage";
import { createPersistentGameRuntimeStore } from "~/v0/play/runtime/createPersistentGameRuntimeStore";
import { readGameRuntimeBoardView } from "~/v0/play/runtime/readGameRuntimeViews";

const createInitialSave = async (): Promise<GameSave> => {
	const adapter = await RuntimeGameEngineAdapter.create({
		config: createEngineTestConfig(),
		nowMs: 0,
	});
	return adapter.readSave();
};

class MemoryGameSaveStorage implements GameSaveStorage {
	readonly saved: GameSave[] = [];
	private save: GameSave | null;

	constructor(save: GameSave | null = null) {
		this.save = save;
	}

	async loadActiveSave(_props: GameSaveStorageScope) {
		return this.save;
	}

	async saveActiveSave({ save }: SaveActiveGameSaveProps) {
		this.save = save;
		this.saved.push(save);
	}

	async deleteActiveSave(_props?: DeleteActiveGameSaveProps) {
		this.save = null;
	}

	async wipe() {
		this.save = null;
	}
}

describe("createPersistentGameRuntimeStore", () => {
	it("creates and immediately persists an initial save when storage is empty", async () => {
		const storage = new MemoryGameSaveStorage();
		const runtime = await createPersistentGameRuntimeStore({
			config: createEngineTestConfig(),
			nowMs: 0,
			storage,
		});

		expect(storage.saved).toHaveLength(1);
		expect(storage.saved[0]).toEqual(runtime.store.getSnapshot().runtime.save);

		await runtime.destroy();
	});

	it("starts from a loaded save instead of rebuilding the initial state", async () => {
		const loadedSave = await createInitialSave();
		loadedSave.board.items["item-instance:1"] = {
			...loadedSave.board.items["item-instance:1"],
			x: 1,
		};
		const storage = new MemoryGameSaveStorage(loadedSave);
		const runtime = await createPersistentGameRuntimeStore({
			config: createEngineTestConfig(),
			nowMs: 0,
			storage,
		});

		expect(
			readGameRuntimeBoardView(runtime.store.getSnapshot()).byId["item-instance:1"]?.x,
		).toBe(1);
		expect(storage.saved).toHaveLength(0);

		await runtime.destroy();
	});
});
