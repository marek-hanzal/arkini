import { Effect } from "effect";

import { DexieGameSaveStorage } from "~/bridge/save/DexieGameSaveStorage";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";

export namespace deleteGameSaveFx {
	export interface Props {
		packageId: string;
		storage?: GameSaveStorage;
	}
}

/** Deletes only the selected package save and never its installed arkpack binary. */
export const deleteGameSaveFx = Effect.fn("deleteGameSaveFx")(function* ({
	packageId,
	storage: providedStorage,
}: deleteGameSaveFx.Props) {
	const storage = providedStorage ?? new DexieGameSaveStorage();
	return yield* Effect.tryPromise({
		try: () => storage.remove(packageId),
		catch: (cause) => cause,
	}).pipe(Effect.ensuring(Effect.sync(() => providedStorage === undefined && storage.close())));
});
