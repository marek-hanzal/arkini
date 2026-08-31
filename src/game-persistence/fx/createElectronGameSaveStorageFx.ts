import { Data, Effect } from "effect";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";

class GameSaveStorageError extends Data.TaggedError("GameSaveStorageError")<{
	readonly operation: "clear" | "read" | "write";
	readonly cause: unknown;
}> {}

interface Props {
	readonly api?: Window["arkini"]["save"];
}

/** Adapts the typed preload Promise transport once into an Effect-native save capability. */
export const createElectronGameSaveStorageFx = Effect.fn("createElectronGameSaveStorageFx")(
	({ api = window.arkini.save }: Props = {}) =>
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
