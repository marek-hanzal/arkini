import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { join } from "node:path";
import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";
import { assertGameSaveKeyFx } from "./assertGameSaveKeyFx";

export namespace readGameSaveFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly key: ArkiniDesktopApi.SaveKey;
	}
}

/** Reads one exact opaque game save or returns null when none is committed. */
export const readGameSaveFx = Effect.fn("readGameSaveFx")(function* ({
	root,
	fileSystem,
	key,
}: readGameSaveFx.Props) {
	const valid = yield* assertGameSaveKeyFx(key);
	const path = join(root, valid.packageId, valid.contentHash, "current.arksave");
	if (!(yield* fileSystem.exists(path))) return null;
	return Uint8Array.from(yield* fileSystem.readFile(path));
});
