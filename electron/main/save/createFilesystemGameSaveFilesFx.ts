import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import { clearGameSaveFx } from "./clearGameSaveFx";
import { ElectronMainError } from "../ElectronMainError";
import type { GameSaveFiles } from "./GameSaveFiles";
import { readGameSaveFx } from "./readGameSaveFx";
import { writeGameSaveFx } from "./writeGameSaveFx";
import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";
import { readGameSaveDirectoryNameFx } from "./readGameSaveDirectoryNameFx";

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
		const filesystemWrite = yield* createFilesystemWriteFx().pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
		);
		const withKeyLockFx = <Value, Failure, Requirements>(
			key: Parameters<GameSaveFiles["readFx"]>[0],
			effect: Effect.Effect<Value, Failure, Requirements>,
		) =>
			readGameSaveDirectoryNameFx(key).pipe(
				Effect.flatMap((directory) =>
					filesystemWrite.withLockFx(join(root, `.${directory}.lock`), effect),
				),
				Effect.mapError((cause) =>
					cause instanceof ElectronMainError
						? cause
						: new ElectronMainError({
								operation: "access game save",
								cause,
							}),
				),
			);
		const readFx: GameSaveFiles["readFx"] = Effect.fn("FilesystemGameSaveFiles.readFx")((key) =>
			withKeyLockFx(
				key,
				readGameSaveFx({
					root,
					fileSystem,
					key,
				}),
			),
		);
		const writeFx: GameSaveFiles["writeFx"] = Effect.fn("FilesystemGameSaveFiles.writeFx")(
			(key, bytes) =>
				writeGameSaveFx({
					root,
					filesystemWrite,
					key,
					bytes,
				}),
		);
		const clearFx: GameSaveFiles["clearFx"] = Effect.fn("FilesystemGameSaveFiles.clearFx")(
			(key) =>
				withKeyLockFx(
					key,
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
