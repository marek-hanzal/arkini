import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { join } from "node:path";
import type { AppearancePreferences } from "./AppearancePreferences";
import { readAppearanceThemeFx } from "./readAppearanceThemeFx";
import { writeAppearanceThemeFx } from "./writeAppearanceThemeFx";

export namespace createFilesystemAppearancePreferencesFx {
	export interface Props {
		readonly userDataPath: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Creates one narrow Effect-native capability over the Electron appearance preference. */
export const createFilesystemAppearancePreferencesFx = Effect.fn(
	"createFilesystemAppearancePreferencesFx",
)(function* ({
	userDataPath,
	fileSystem: providedFileSystem,
}: createFilesystemAppearancePreferencesFx.Props) {
	const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
	const root = join(userDataPath, "arkini", "preferences");
	return {
		readFx: readAppearanceThemeFx({
			root,
			fileSystem,
		}),
		writeFx: (theme) =>
			writeAppearanceThemeFx({
				root,
				fileSystem,
				theme,
			}),
	} satisfies AppearancePreferences;
});
