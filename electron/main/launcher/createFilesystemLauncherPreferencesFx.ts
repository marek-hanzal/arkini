import { FileSystem } from "effect";
import { Effect, Semaphore } from "effect";
import { join } from "node:path";
import type { LauncherPreferences } from "./LauncherPreferences";
import { readLastPackageIdFx } from "./readLastPackageIdFx";
import { writeLastPackageIdFx as writeLastPackageIdFileFx } from "./writeLastPackageIdFx";

export namespace createFilesystemLauncherPreferencesFx {
	export interface Props {
		readonly userDataPath: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Creates one narrow Effect-native capability over application-wide launcher preferences. */
export const createFilesystemLauncherPreferencesFx = Effect.fn(
	"createFilesystemLauncherPreferencesFx",
)(function* ({
	userDataPath,
	fileSystem: providedFileSystem,
}: createFilesystemLauncherPreferencesFx.Props) {
	const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
	const root = join(userDataPath, "arkini", "preferences");
	// The fixed pending path makes operation ordering part of this repository's contract.
	const operations = yield* Semaphore.make(1);
	const writeLastPackageIdFx: LauncherPreferences["writeLastPackageIdFx"] = Effect.fn(
		"FilesystemLauncherPreferences.writeLastPackageIdFx",
	)((packageId) =>
		operations.withPermits(1)(
			writeLastPackageIdFileFx({
				root,
				fileSystem,
				packageId,
			}),
		),
	);
	return {
		readLastPackageIdFx: operations.withPermits(1)(
			readLastPackageIdFx({
				root,
				fileSystem,
			}),
		),
		writeLastPackageIdFx,
	} satisfies LauncherPreferences;
});
