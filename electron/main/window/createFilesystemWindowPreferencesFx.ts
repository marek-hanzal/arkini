import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import { WindowModeSchema } from "~electron/contract/window/WindowModeSchema";
import type { ElectronMainError } from "../ElectronMainError";
import { readElectronPreferenceFx } from "../preference/readElectronPreferenceFx";
import { writeElectronPreferenceFx } from "../preference/writeElectronPreferenceFx";
import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";

/** Effect-native main-process capability for the global native window mode. */
export interface WindowPreferences {
	readonly readModeFx: Effect.Effect<WindowModeSchema.Type, ElectronMainError>;
	readonly writeModeFx: (mode: WindowModeSchema.Type) => Effect.Effect<void, ElectronMainError>;
}

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
