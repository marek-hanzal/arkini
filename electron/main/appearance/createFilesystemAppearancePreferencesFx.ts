import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
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
	return {
		readThemeFx: readAppearanceThemeFx({
			root,
			fileSystem,
		}),
		writeThemeFx: (theme) =>
			writeAppearanceThemeFx({
				root,
				fileSystem,
				theme,
			}),
		readAccentFx: readAppearanceAccentFx({
			root,
			fileSystem,
		}),
		writeAccentFx: (accent) =>
			writeAppearanceAccentFx({
				root,
				fileSystem,
				accent,
			}),
	} satisfies AppearancePreferences;
});
