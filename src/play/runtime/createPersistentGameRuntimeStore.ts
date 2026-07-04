import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { loadDefaultGameConfig } from "~/config/compiled/defaultGameConfig";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { RuntimeGameEngineAdapter } from "~/engine/runtime/RuntimeGameEngineAdapter";
import { RandomServiceFx } from "~/random/context/RandomServiceFx";
import { createDefaultDexieGameSaveStorage } from "~/storage/DexieGameSaveStorage";
import type { CloseableGameSaveStorage, GameSaveStorage } from "~/storage/GameSaveStorage";
import { hashRuntimeGameConfigFx } from "~/storage/hashRuntimeGameConfigFx";
import { connectGameRuntimeSavePersistence } from "~/play/runtime/connectGameRuntimeSavePersistence";
import { GameRuntimeStartupError } from "~/play/runtime/GameRuntimeStartupError";
import { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";
import { runGameRuntimeEffect } from "~/play/runtime/runGameRuntimeEffect";

export namespace createPersistentGameRuntimeStoreFx {
	export interface Options {
		config?: GameConfig;
		debounceMs?: number;
		nowMs?: number;
		onPersistenceError?(error: unknown): void;
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

const loadDefaultGameConfigFx = Effect.fn(
	"createPersistentGameRuntimeStoreFx.loadDefaultGameConfigFx",
)(function* () {
	return yield* Effect.tryPromise({
		catch: GameRuntimeStartupError.configLoadFailed,
		try: () => loadDefaultGameConfig(),
	});
});

const hashConfigFx = Effect.fn("createPersistentGameRuntimeStoreFx.hashConfigFx")(function* (
	config: GameConfig,
) {
	return yield* hashRuntimeGameConfigFx(config).pipe(
		Effect.mapError(GameRuntimeStartupError.configHashFailed),
	);
});

const loadActiveSaveFx = Effect.fn("createPersistentGameRuntimeStoreFx.loadActiveSaveFx")(
	function* ({
		config,
		configHash,
		storage,
	}: {
		config: GameConfig;
		configHash: string;
		storage: GameSaveStorage;
	}) {
		return yield* Effect.tryPromise({
			catch: GameRuntimeStartupError.storageLoadFailed,
			try: () =>
				storage.loadActiveSave({
					config,
					configHash,
				}),
		});
	},
);

const saveActiveSaveFx = Effect.fn("createPersistentGameRuntimeStoreFx.saveActiveSaveFx")(
	function* ({
		config,
		configHash,
		save,
		storage,
	}: {
		config: GameConfig;
		configHash: string;
		save: GameSave;
		storage: GameSaveStorage;
	}) {
		yield* Effect.tryPromise({
			catch: GameRuntimeStartupError.storageSaveFailed,
			try: () =>
				storage.saveActiveSave({
					config,
					configHash,
					save,
				}),
		});
	},
);

const createRuntimeAdapterFx = Effect.fn(
	"createPersistentGameRuntimeStoreFx.createRuntimeAdapterFx",
)(function* ({
	config,
	initialSave,
	nowMs,
}: {
	config: GameConfig;
	initialSave: GameSave | null;
	nowMs: number;
}) {
	const random = yield* RandomServiceFx;
	return yield* Effect.tryPromise({
		catch: GameRuntimeStartupError.adapterCreateFailed,
		try: () =>
			RuntimeGameEngineAdapter.create({
				config,
				initialSave: initialSave ?? undefined,
				nowMs,
				random,
			}),
	});
});

const createRuntimeStoreFx = Effect.fn("createPersistentGameRuntimeStoreFx.createRuntimeStoreFx")(
	function* ({ adapter, nowMs }: { adapter: RuntimeGameEngineAdapter; nowMs: number }) {
		return yield* Effect.tryPromise({
			catch: GameRuntimeStartupError.storeCreateFailed,
			try: () =>
				GameRuntimeStore.create({
					adapter,
					nowMs,
				}),
		});
	},
);

export const createPersistentGameRuntimeStoreFx = Effect.fn("createPersistentGameRuntimeStoreFx")(
	function* ({
		config,
		debounceMs,
		nowMs = Date.now(),
		onPersistenceError,
		storage = createDefaultDexieGameSaveStorage(),
	}: createPersistentGameRuntimeStoreFx.Options = {}) {
		const resolvedConfig = config ?? (yield* loadDefaultGameConfigFx());
		const configHash = yield* hashConfigFx(resolvedConfig);
		const loadedSave = yield* loadActiveSaveFx({
			config: resolvedConfig,
			configHash,
			storage,
		});
		const adapter = yield* createRuntimeAdapterFx({
			config: resolvedConfig,
			initialSave: loadedSave,
			nowMs,
		});
		const store = yield* createRuntimeStoreFx({
			adapter,
			nowMs,
		});

		if (!loadedSave) {
			yield* saveActiveSaveFx({
				config: resolvedConfig,
				configHash,
				save: adapter.readSave(),
				storage,
			});
		}

		const random = yield* RandomServiceFx;
		const persistence = connectGameRuntimeSavePersistence({
			debounceMs,
			onError: onPersistenceError,
			storage: {
				save: (save) =>
					runGameRuntimeEffect(
						saveActiveSaveFx({
							config: resolvedConfig,
							configHash,
							save,
							storage,
						}),
						{
							random,
						},
					),
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
		} satisfies createPersistentGameRuntimeStoreFx.Result;
	},
);
