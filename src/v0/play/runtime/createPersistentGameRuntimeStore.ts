import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { defaultGameConfig } from "~/v0/game/compiled/defaultGameConfig";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { RuntimeGameEngineAdapter } from "~/v0/game/engine/runtime/RuntimeGameEngineAdapter";
import type { RandomService } from "~/v0/random/context/RandomService";
import {
	createDefaultDexieGameSaveStorage,
	hashRuntimeGameConfig,
	type CloseableGameSaveStorage,
	type GameSaveStorage,
} from "~/v0/game/storage";
import { connectGameRuntimeSavePersistence } from "~/v0/play/runtime/connectGameRuntimeSavePersistence";
import { GameRuntimeStore } from "~/v0/play/runtime/GameRuntimeStore";

export namespace createPersistentGameRuntimeStore {
	export interface Options {
		config?: GameConfig;
		debounceMs?: number;
		nowMs?: number;
		onPersistenceError?(error: unknown): void;
		random?: RandomService;
		storage?: GameSaveStorage;
	}

	export interface Result {
		store: GameRuntimeStore;
		destroy(): Promise<void>;
		flush(): Promise<void>;
	}
}

const isCloseableStorage = (storage: GameSaveStorage): storage is CloseableGameSaveStorage =>
	"close" in storage && typeof storage.close === "function";

const saveThroughStorage = ({
	configHash,
	save,
	storage,
}: {
	configHash: string;
	save: GameSave;
	storage: GameSaveStorage;
}) =>
	storage.saveActiveSave({
		configHash,
		save,
	});

export const createPersistentGameRuntimeStore = async ({
	config = defaultGameConfig,
	debounceMs,
	nowMs = Date.now(),
	onPersistenceError,
	random,
	storage = createDefaultDexieGameSaveStorage(),
}: createPersistentGameRuntimeStore.Options = {}): Promise<createPersistentGameRuntimeStore.Result> => {
	const configHash = await hashRuntimeGameConfig(config);
	const loadedSave = await storage.loadActiveSave({
		configHash,
		gameId: config.game.id,
	});
	const adapter = await RuntimeGameEngineAdapter.create({
		config,
		initialSave: loadedSave ?? undefined,
		nowMs,
		random,
	});
	const store = await GameRuntimeStore.create({
		adapter,
		nowMs,
	});

	if (!loadedSave) {
		await saveThroughStorage({
			configHash,
			save: adapter.readSave(),
			storage,
		});
	}

	const persistence = connectGameRuntimeSavePersistence({
		debounceMs,
		onError: onPersistenceError,
		storage: {
			save: (save) =>
				saveThroughStorage({
					configHash,
					save,
					storage,
				}),
		},
		store,
	});

	return {
		store,
		async destroy() {
			await persistence.destroy();
			store.destroy();
			if (isCloseableStorage(storage)) {
				storage.close();
			}
		},
		flush: persistence.flush,
	};
};
