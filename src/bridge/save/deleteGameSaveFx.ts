import { Effect } from "effect";
import { createGameSaveStorage } from "~/bridge/save/createGameSaveStorage";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";

export namespace deleteGameSaveFx {
	export interface Props {
		key: GameSaveStorage.Key;
		storage?: GameSaveStorage;
	}
}

/** Deletes only one exact package/hash save and never its installed Arkpack binary. */
export const deleteGameSaveFx = Effect.fn("deleteGameSaveFx")(function* ({
	key,
	storage: providedStorage,
}: deleteGameSaveFx.Props) {
	const storage = providedStorage ?? createGameSaveStorage();
	return yield* Effect.tryPromise({
		try: () => storage.clear(key),
		catch: (cause) => cause,
	}).pipe(Effect.ensuring(Effect.sync(() => providedStorage === undefined && storage.close())));
});
