import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { join } from "node:path";
import type { CheatPreferences } from "./CheatPreferences";
import { readCheatAvailabilityFx } from "./readCheatAvailabilityFx";
import { writeCheatAvailabilityFx } from "./writeCheatAvailabilityFx";

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
		return {
			readAvailableFx: readCheatAvailabilityFx({
				root,
				fileSystem,
			}),
			writeAvailableFx: (available) =>
				writeCheatAvailabilityFx({
					root,
					fileSystem,
					available,
				}),
		} satisfies CheatPreferences;
	},
);
