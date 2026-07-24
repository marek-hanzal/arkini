import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { join } from "node:path";
import type { LauncherPreferences } from "./LauncherPreferences";
import { readLastPackageIdFx } from "./readLastPackageIdFx";
import { writeLastPackageIdFx } from "./writeLastPackageIdFx";

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
	return {
		readLastPackageIdFx: readLastPackageIdFx({
			root,
			fileSystem,
		}),
		writeLastPackageIdFx: (packageId) =>
			writeLastPackageIdFx({
				root,
				fileSystem,
				packageId,
			}),
	} satisfies LauncherPreferences;
});
