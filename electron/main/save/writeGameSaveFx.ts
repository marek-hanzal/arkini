import { Effect } from "effect";
import { join } from "node:path";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ElectronMainError } from "../ElectronMainError";
import { readGameSaveDirectoryNameFx } from "./readGameSaveDirectoryNameFx";
import type { FilesystemWrite } from "~/engine/filesystem/FilesystemWrite";

export namespace writeGameSaveFx {
	export interface Props {
		readonly root: string;
		readonly filesystemWrite: FilesystemWrite;
		readonly key: ArkiniElectronApi.SaveKey;
		readonly bytes: Uint8Array;
	}
}

/** Writes one exact committed save through the shared crash-safe file primitive. */
export const writeGameSaveFx = Effect.fn("writeGameSaveFx")(
	({ root, filesystemWrite, key, bytes }: writeGameSaveFx.Props) =>
		Effect.gen(function* () {
			const directoryName = yield* readGameSaveDirectoryNameFx(key);
			const directory = join(root, directoryName);
			const current = join(directory, "current.arksave");
			yield* filesystemWrite.replaceFileFx({
				lock: join(root, `.${directoryName}.lock`),
				target: current,
				bytes,
			});
		}).pipe(
			Effect.mapError((cause) =>
				cause instanceof ElectronMainError
					? cause
					: new ElectronMainError({
							operation: "write game save",
							cause,
						}),
			),
		),
);
