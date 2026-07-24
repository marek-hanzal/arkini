import { FileSystem } from "effect";
import { Effect, Semaphore } from "effect";
import { join } from "node:path";
import type { AppearancePreferences } from "./AppearancePreferences";
import { readAppearanceAccentFx } from "./readAppearanceAccentFx";
import { readAppearanceThemeFx } from "./readAppearanceThemeFx";
import { writeAppearanceAccentFx } from "./writeAppearanceAccentFx";
import { writeAppearanceThemeFx } from "./writeAppearanceThemeFx";

export namespace createFilesystemAppearancePreferencesFx {
	export interface Props {
		readonly userDataPath: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Creates one narrow Effect-native capability over Electron appearance preferences. */
export const createFilesystemAppearancePreferencesFx = Effect.fn(
	"createFilesystemAppearancePreferencesFx",
)(function* ({
	userDataPath,
	fileSystem: providedFileSystem,
}: createFilesystemAppearancePreferencesFx.Props) {
	const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
	const root = join(userDataPath, "arkini", "preferences");
	const themeWriteSemaphore = yield* Semaphore.make(1);
	const accentWriteSemaphore = yield* Semaphore.make(1);
	const writeThemeFx: AppearancePreferences["writeThemeFx"] = Effect.fn(
		"FilesystemAppearancePreferences.writeThemeFx",
	)((theme) =>
		themeWriteSemaphore.withPermits(1)(
			writeAppearanceThemeFx({
				root,
				fileSystem,
				theme,
			}),
		),
	);
	const writeAccentFx: AppearancePreferences["writeAccentFx"] = Effect.fn(
		"FilesystemAppearancePreferences.writeAccentFx",
	)((accent) =>
		accentWriteSemaphore.withPermits(1)(
			writeAppearanceAccentFx({
				root,
				fileSystem,
				accent,
			}),
		),
	);
	return {
		readThemeFx: readAppearanceThemeFx({
			root,
			fileSystem,
		}),
		writeThemeFx,
		readAccentFx: readAppearanceAccentFx({
			root,
			fileSystem,
		}),
		writeAccentFx,
	} satisfies AppearancePreferences;
});
