import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import { WindowModeSchema } from "../../contract/window/WindowModeSchema";
import { readElectronPreferenceFx } from "../preference/readElectronPreferenceFx";
import { writeElectronPreferenceFx } from "../preference/writeElectronPreferenceFx";
import type { WindowPreferences } from "./WindowPreferences";
import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";

export namespace createFilesystemWindowPreferencesFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Creates the one persisted global window-mode capability. */
export const createFilesystemWindowPreferencesFx = Effect.fn("createFilesystemWindowPreferencesFx")(
	function* ({
		root,
		fileSystem: providedFileSystem,
	}: createFilesystemWindowPreferencesFx.Props) {
		const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
		const path = join(root, "window.mode.json");
		const filesystemWrite = yield* createFilesystemWriteFx().pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
		);
		const writeModeFx = Effect.fn("FilesystemWindowPreferences.writeModeFx")(
			(mode: WindowModeSchema.Type) =>
				writeElectronPreferenceFx({
					filesystemWrite,
					lock: join(root, ".window-mode.lock"),
					target: path,
					value: mode,
					operation: "persist the window mode preference",
					serialize: (value) => JSON.stringify(WindowModeSchema.parse(value)),
				}),
		);

		return {
			readModeFx: readElectronPreferenceFx({
				fileSystem,
				path,
				fallback: "default" as const,
				operation: "read the window mode preference",
				parse: (stored) => {
					try {
						return WindowModeSchema.safeParse(JSON.parse(stored)).data;
					} catch {
						return undefined;
					}
				},
			}),
			writeModeFx,
		} satisfies WindowPreferences;
	},
);
