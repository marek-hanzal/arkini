import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import { clearGameSaveFx } from "./clearGameSaveFx";
import type { GameSaveFiles } from "./GameSaveFiles";
import { readGameSaveFx } from "./readGameSaveFx";
import { writeGameSaveFx } from "./writeGameSaveFx";

export namespace createFilesystemGameSaveFilesFx {
	export interface Props {
		readonly userDataPath: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Creates one narrow Effect-native capability over the Electron save namespace. */
export const createFilesystemGameSaveFilesFx = Effect.fn("createFilesystemGameSaveFilesFx")(
	function* ({
		userDataPath,
		fileSystem: providedFileSystem,
	}: createFilesystemGameSaveFilesFx.Props) {
		const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
		const root = join(userDataPath, "arkini", "saves");
		const readFx: GameSaveFiles["readFx"] = Effect.fn("FilesystemGameSaveFiles.readFx")((key) =>
			readGameSaveFx({
				root,
				fileSystem,
				key,
			}),
		);
		const writeFx: GameSaveFiles["writeFx"] = Effect.fn("FilesystemGameSaveFiles.writeFx")(
			(key, bytes) =>
				writeGameSaveFx({
					root,
					fileSystem,
					key,
					bytes,
				}),
		);
		const clearFx: GameSaveFiles["clearFx"] = Effect.fn("FilesystemGameSaveFiles.clearFx")(
			(key) =>
				clearGameSaveFx({
					root,
					fileSystem,
					key,
				}),
		);
		return {
			readFx,
			writeFx,
			clearFx,
		} satisfies GameSaveFiles;
	},
);
