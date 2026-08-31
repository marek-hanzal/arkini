import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import { LastPackageIdSchema } from "~electron/contract/launcher/LastPackageIdSchema";
import type { ElectronMainError } from "../ElectronMainError";
import { readElectronPreferenceFx } from "../preference/readElectronPreferenceFx";
import { writeElectronPreferenceFx } from "../preference/writeElectronPreferenceFx";
import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";

/** Effect-native main-process capability for application-wide launcher preferences. */
export interface LauncherPreferences {
	readonly readLastPackageIdFx: Effect.Effect<LastPackageIdSchema.Type | null, ElectronMainError>;
	readonly writeLastPackageIdFx: (
		packageId: LastPackageIdSchema.Type,
	) => Effect.Effect<void, ElectronMainError>;
}

export namespace createFilesystemLauncherPreferencesFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Creates one narrow Effect-native capability over application-wide launcher preferences. */
export const createFilesystemLauncherPreferencesFx = Effect.fn(
	"createFilesystemLauncherPreferencesFx",
)(function* ({
	root,
	fileSystem: providedFileSystem,
}: createFilesystemLauncherPreferencesFx.Props) {
	const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
	const currentPath = join(root, "launcher.last-package.json");
	const filesystemWrite = yield* createFilesystemWriteFx().pipe(
		Effect.provideService(FileSystem.FileSystem, fileSystem),
	);
	const writeLastPackageIdFx = Effect.fn("FilesystemLauncherPreferences.writeLastPackageIdFx")(
		(packageId: LastPackageIdSchema.Type) =>
			writeElectronPreferenceFx({
				filesystemWrite,
				lock: join(root, ".launcher-last-package.lock"),
				target: currentPath,
				value: packageId,
				operation: "persist the last package preference",
				serialize: (value) => JSON.stringify(LastPackageIdSchema.parse(value)),
			}),
	);
	return {
		readLastPackageIdFx: readElectronPreferenceFx({
			fileSystem,
			path: currentPath,
			fallback: null,
			operation: "read the last package preference",
			parse: (stored) => {
				try {
					return LastPackageIdSchema.safeParse(JSON.parse(stored)).data;
				} catch {
					return undefined;
				}
			},
		}),
		writeLastPackageIdFx,
	} satisfies LauncherPreferences;
});
