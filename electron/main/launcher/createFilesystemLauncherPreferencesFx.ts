import { FileSystem } from "effect";
import { Effect, Semaphore } from "effect";
import { join } from "node:path";
import { LastPackageIdSchema } from "../../contract/launcher/LastPackageIdSchema";
import { readElectronPreferenceFx } from "../preference/readElectronPreferenceFx";
import { writeElectronPreferenceFx } from "../preference/writeElectronPreferenceFx";
import type { LauncherPreferences } from "./LauncherPreferences";

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
	const currentPath = join(root, "launcher.last-package");
	// The fixed pending path makes operation ordering part of this repository's contract.
	const operations = yield* Semaphore.make(1);
	const writeLastPackageIdFx: LauncherPreferences["writeLastPackageIdFx"] = Effect.fn(
		"FilesystemLauncherPreferences.writeLastPackageIdFx",
	)((packageId) =>
		operations.withPermits(1)(
			writeElectronPreferenceFx({
				root,
				fileSystem,
				pendingPath: join(root, "launcher-last-package.pending"),
				currentPath,
				value: packageId,
				operation: "persist the last package preference",
				serialize: (value) => LastPackageIdSchema.parse(value),
			}),
		),
	);
	return {
		readLastPackageIdFx: operations.withPermits(1)(
			readElectronPreferenceFx({
				fileSystem,
				path: currentPath,
				fallback: null,
				operation: "read the last package preference",
				parse: (stored) => LastPackageIdSchema.safeParse(stored).data,
			}),
		),
		writeLastPackageIdFx,
	} satisfies LauncherPreferences;
});
