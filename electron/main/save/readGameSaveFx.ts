import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ElectronMainError } from "../ElectronMainError";
import { assertGameSaveKeyFx } from "./assertGameSaveKeyFx";

export namespace readGameSaveFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly key: ArkiniElectronApi.SaveKey;
	}
}

/** Reads one exact opaque game save or returns null when none is committed. */
export const readGameSaveFx = Effect.fn("readGameSaveFx")(
	({ root, fileSystem, key }: readGameSaveFx.Props) =>
		Effect.gen(function* () {
			const valid = yield* assertGameSaveKeyFx(key);
			const path = join(root, valid.packageId, "current.arksave");
			if (!(yield* fileSystem.exists(path))) return null;
			return Uint8Array.from(yield* fileSystem.readFile(path));
		}).pipe(
			Effect.mapError((cause) =>
				cause instanceof ElectronMainError
					? cause
					: new ElectronMainError({
							operation: "read game save",
							cause,
						}),
			),
		),
);
