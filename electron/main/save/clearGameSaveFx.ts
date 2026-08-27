import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ElectronMainError } from "../ElectronMainError";
import { readGameSaveDirectoryNameFx } from "./readGameSaveDirectoryNameFx";

export namespace clearGameSaveFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly key: ArkiniElectronApi.SaveKey;
	}
}

/** Clears the stable save owned by one package. */
export const clearGameSaveFx = Effect.fn("clearGameSaveFx")(
	({ root, fileSystem, key }: clearGameSaveFx.Props) =>
		Effect.gen(function* () {
			yield* fileSystem.remove(join(root, yield* readGameSaveDirectoryNameFx(key)), {
				recursive: true,
				force: true,
			});
		}).pipe(
			Effect.mapError((cause) =>
				cause instanceof ElectronMainError
					? cause
					: new ElectronMainError({
							operation: "clear game save",
							cause,
						}),
			),
		),
);
