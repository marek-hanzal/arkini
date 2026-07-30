import { FileSystem } from "effect";
import { Effect, Semaphore } from "effect";
import { clearGameSaveFx } from "./clearGameSaveFx";
import type { GameSaveFiles } from "./GameSaveFiles";
import { readGameSaveFx } from "./readGameSaveFx";
import { writeGameSaveFx } from "./writeGameSaveFx";

export namespace createFilesystemGameSaveFilesFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Creates one narrow Effect-native capability over the Electron save namespace. */
export const createFilesystemGameSaveFilesFx = Effect.fn("createFilesystemGameSaveFilesFx")(
	function* ({ root, fileSystem: providedFileSystem }: createFilesystemGameSaveFilesFx.Props) {
		const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
		// IPC callers cannot be required to share the renderer's autosave mutex.
		// This repository therefore owns ordering around each shared pending/current namespace.
		const operations = yield* Semaphore.make(1);
		const readFx: GameSaveFiles["readFx"] = Effect.fn("FilesystemGameSaveFiles.readFx")((key) =>
			operations.withPermits(1)(
				readGameSaveFx({
					root,
					fileSystem,
					key,
				}),
			),
		);
		const writeFx: GameSaveFiles["writeFx"] = Effect.fn("FilesystemGameSaveFiles.writeFx")(
			(key, bytes) =>
				operations.withPermits(1)(
					writeGameSaveFx({
						root,
						fileSystem,
						key,
						bytes,
					}),
				),
		);
		const clearFx: GameSaveFiles["clearFx"] = Effect.fn("FilesystemGameSaveFiles.clearFx")(
			(key) =>
				operations.withPermits(1)(
					clearGameSaveFx({
						root,
						fileSystem,
						key,
					}),
				),
		);
		return {
			readFx,
			writeFx,
			clearFx,
		} satisfies GameSaveFiles;
	},
);
