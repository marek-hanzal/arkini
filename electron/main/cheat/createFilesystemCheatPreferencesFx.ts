import { FileSystem } from "effect";
import { Effect, Semaphore } from "effect";
import { join } from "node:path";
import { CheatAvailabilitySchema } from "../../contract/cheat/CheatAvailabilitySchema";
import { readElectronPreferenceFx } from "../preference/readElectronPreferenceFx";
import { writeElectronPreferenceFx } from "../preference/writeElectronPreferenceFx";
import type { CheatPreferences } from "./CheatPreferences";

export namespace createFilesystemCheatPreferencesFx {
	export interface Props {
		readonly userDataPath: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Creates one narrow Effect-native capability over application-wide cheat preferences. */
export const createFilesystemCheatPreferencesFx = Effect.fn("createFilesystemCheatPreferencesFx")(
	function* ({
		userDataPath,
		fileSystem: providedFileSystem,
	}: createFilesystemCheatPreferencesFx.Props) {
		const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
		const root = join(userDataPath, "arkini", "preferences");
		const currentPath = join(root, "cheats.available");
		const writeSemaphore = yield* Semaphore.make(1);
		const writeAvailableFx: CheatPreferences["writeAvailableFx"] = Effect.fn(
			"FilesystemCheatPreferences.writeAvailableFx",
		)((available) =>
			writeSemaphore.withPermits(1)(
				writeElectronPreferenceFx({
					root,
					fileSystem,
					pendingPath: join(root, "cheats-available.pending"),
					currentPath,
					value: available,
					operation: "persist the cheat availability preference",
					serialize: (value) => String(CheatAvailabilitySchema.parse(value)),
				}),
			),
		);
		return {
			readAvailableFx: readElectronPreferenceFx({
				fileSystem,
				path: currentPath,
				fallback: false,
				operation: "read the cheat availability preference",
				parse: (stored) => {
					const value = stored.trim();
					if (value === "true") return true;
					if (value === "false") return false;
					return undefined;
				},
			}),
			writeAvailableFx,
		} satisfies CheatPreferences;
	},
);
