import { FileSystem } from "effect";
import { Effect, Semaphore } from "effect";
import { join } from "node:path";
import { WindowModeSchema } from "../../contract/window/WindowModeSchema";
import { readElectronPreferenceFx } from "../preference/readElectronPreferenceFx";
import { writeElectronPreferenceFx } from "../preference/writeElectronPreferenceFx";
import type { WindowPreferences } from "./WindowPreferences";

export namespace createFilesystemWindowPreferencesFx {
	export interface Props {
		readonly userDataPath: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Creates the one persisted global window-mode capability. */
export const createFilesystemWindowPreferencesFx = Effect.fn("createFilesystemWindowPreferencesFx")(
	function* ({
		userDataPath,
		fileSystem: providedFileSystem,
	}: createFilesystemWindowPreferencesFx.Props) {
		const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
		const root = join(userDataPath, "arkini", "preferences");
		const path = join(root, "window.mode");
		const writeSemaphore = yield* Semaphore.make(1);
		const writeModeFx: WindowPreferences["writeModeFx"] = Effect.fn(
			"FilesystemWindowPreferences.writeModeFx",
		)((mode) =>
			writeSemaphore.withPermits(1)(
				writeElectronPreferenceFx({
					root,
					fileSystem,
					pendingPath: join(root, "window.pending"),
					currentPath: path,
					value: mode,
					operation: "persist the window mode preference",
					serialize: (value) => WindowModeSchema.parse(value),
				}),
			),
		);

		return {
			readModeFx: readElectronPreferenceFx({
				fileSystem,
				path,
				fallback: "default" as const,
				operation: "read the window mode preference",
				parse: (stored) => WindowModeSchema.safeParse(stored.trim()).data,
			}),
			writeModeFx,
		} satisfies WindowPreferences;
	},
);
