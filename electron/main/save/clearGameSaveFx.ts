import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { join } from "node:path";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { assertGameSaveKeyFx } from "./assertGameSaveKeyFx";

export namespace clearGameSaveFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly key: ArkiniElectronApi.SaveKey;
	}
}

/** Clears only one exact package/hash save directory. */
export const clearGameSaveFx = Effect.fn("clearGameSaveFx")(function* ({
	root,
	fileSystem,
	key,
}: clearGameSaveFx.Props) {
	const valid = yield* assertGameSaveKeyFx(key);
	yield* fileSystem.remove(join(root, valid.packageId, valid.contentHash), {
		recursive: true,
		force: true,
	});
});
