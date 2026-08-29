import { Effect } from "effect";
import type { GameSaveStorage } from "~/engine/save/GameSaveStorage";
import { GameSaveStorageError } from "~/renderer/save/GameSaveStorageError";

export namespace createElectronGameSaveStorageFx {
	export interface Props {
		readonly api?: Window["arkini"]["save"];
	}
}

/** Adapts the typed preload Promise transport once into an Effect-native save capability. */
export const createElectronGameSaveStorageFx = Effect.fn("createElectronGameSaveStorageFx")(
	({ api = window.arkini.save }: createElectronGameSaveStorageFx.Props = {}) =>
		Effect.succeed({
			readFx: Effect.fn("GameSaveStorage.readFx")((key: GameSaveStorage.Key) =>
				Effect.tryPromise({
					try: () => api.read(key),
					catch: (cause) =>
						new GameSaveStorageError({
							operation: "read",
							cause,
						}),
				}),
			),
			clearFx: Effect.fn("GameSaveStorage.clearFx")((key: GameSaveStorage.Key) =>
				Effect.tryPromise({
					try: () => api.clear(key),
					catch: (cause) =>
						new GameSaveStorageError({
							operation: "clear",
							cause,
						}),
				}),
			),
			writeFx: Effect.fn("GameSaveStorage.writeFx")(
				(key: GameSaveStorage.Key, bytes: Uint8Array) =>
					Effect.tryPromise({
						try: () => api.write(key, bytes),
						catch: (cause) =>
							new GameSaveStorageError({
								operation: "write",
								cause,
							}),
					}),
			),
		} satisfies GameSaveStorage),
);
