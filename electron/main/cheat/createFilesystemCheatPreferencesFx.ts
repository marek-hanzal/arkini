import { FileSystem } from "effect";
import { Effect, Semaphore } from "effect";
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
		const writeSemaphore = yield* Semaphore.make(1);
		const writeAvailableFx: CheatPreferences["writeAvailableFx"] = Effect.fn(
			"FilesystemCheatPreferences.writeAvailableFx",
		)((available) =>
			writeSemaphore.withPermits(1)(
				writeCheatAvailabilityFx({
					root,
					fileSystem,
					available,
				}),
			),
		);
		return {
			readAvailableFx: readCheatAvailabilityFx({
				root,
				fileSystem,
			}),
			writeAvailableFx,
		} satisfies CheatPreferences;
	},
);
