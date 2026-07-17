import { Effect } from "effect";
import { createGameSaveStorageFx } from "~/bridge/save/createGameSaveStorageFx";
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
	const storage = providedStorage ?? (yield* createGameSaveStorageFx());
	yield* storage.clearFx(key);
});
