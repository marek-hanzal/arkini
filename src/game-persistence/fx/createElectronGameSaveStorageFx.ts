import { Data, Effect } from "effect";
import type { GameSaveSlotSchema } from "~/game-persistence/schema/GameSaveSlotSchema";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";
class GameSaveStorageError extends Data.TaggedError("GameSaveStorageError")<{
	readonly operation: "read" | "write" | "clear" | "list" | "restore";
	readonly cause: unknown;
}> {}
interface Props {
	readonly api?: Window["serakki"]["save"];
}
/** Adapts the preload transport into the save capability. */
export const createElectronGameSaveStorageFx = Effect.fn("createElectronGameSaveStorageFx")(
	({ api = window.serakki.save }: Props = {}) => {
		const requestFx = <A>(
			operation: GameSaveStorageError["operation"],
			requestFn: () => Promise<A>,
		) =>
			Effect.tryPromise({
				try: requestFn,
				catch: (cause) =>
					new GameSaveStorageError({
						operation,
						cause,
					}),
			});
		return Effect.succeed({
			readFx: (key: GameSaveStorage.Key, slot?: GameSaveSlotSchema.Type) =>
				requestFx("read", () => api.readFn(key, slot)),
			writeFx: (key: GameSaveStorage.Key, bytes: Uint8Array, slot?: "current" | "manual") =>
				requestFx("write", () => api.writeFn(key, bytes, slot)),
			clearFx: (key: GameSaveStorage.Key) => requestFx("clear", () => api.clearFn(key)),
			listFx: (key: GameSaveStorage.Key) => requestFx("list", () => api.listFn(key)),
			restoreFx: (key: GameSaveStorage.Key, bytes: Uint8Array) =>
				requestFx("restore", () => api.restoreFn(key, bytes)),
		} satisfies GameSaveStorage);
	},
);
