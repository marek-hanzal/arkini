import type { GameConfig } from "~/config/GameConfigSchema";
import { defaultGameConfig } from "~/config/compiled/defaultGameConfig";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { RuntimeGameEngineAdapter } from "~/engine/runtime/RuntimeGameEngineAdapter";
import type { RandomService } from "~/random/context/RandomService";
import {
	createDefaultDexieGameSaveStorage,
	hashRuntimeGameConfig,
	type CloseableGameSaveStorage,
	type GameSaveStorage,
} from "~/storage";
import { connectGameRuntimeSavePersistence } from "~/play/runtime/connectGameRuntimeSavePersistence";
import { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";

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
	config,
	configHash,
	save,
	storage,
}: {
	config: GameConfig;
	configHash: string;
	save: GameSave;
	storage: GameSaveStorage;
}) =>
	storage.saveActiveSave({
		config,
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
		config,
		configHash,
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
			config,
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
					config,
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
