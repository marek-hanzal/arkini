import { FileSystem } from "effect";
import { Effect, Semaphore } from "effect";
import { join } from "node:path";
import { AppearanceAccentSchema } from "../../contract/appearance/AppearanceAccentSchema";
import { AppearanceThemeSchema } from "../../contract/appearance/AppearanceThemeSchema";
import { readElectronPreferenceFx } from "../preference/readElectronPreferenceFx";
import { writeElectronPreferenceFx } from "../preference/writeElectronPreferenceFx";
import type { AppearancePreferences } from "./AppearancePreferences";

export namespace createFilesystemAppearancePreferencesFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Creates one narrow Effect-native capability over Electron appearance preferences. */
export const createFilesystemAppearancePreferencesFx = Effect.fn(
	"createFilesystemAppearancePreferencesFx",
)(function* ({
	root,
	fileSystem: providedFileSystem,
}: createFilesystemAppearancePreferencesFx.Props) {
	const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
	const themeWriteSemaphore = yield* Semaphore.make(1);
	const accentWriteSemaphore = yield* Semaphore.make(1);
	const themePath = join(root, "appearance.theme");
	const accentPath = join(root, "appearance.accent");
	const writeThemeFx: AppearancePreferences["writeThemeFx"] = Effect.fn(
		"FilesystemAppearancePreferences.writeThemeFx",
	)((theme) =>
		themeWriteSemaphore.withPermits(1)(
			writeElectronPreferenceFx({
				root,
				fileSystem,
				pendingPath: join(root, "appearance.pending"),
				currentPath: themePath,
				value: theme,
				operation: "persist the appearance preference",
				serialize: (value) => AppearanceThemeSchema.parse(value),
			}),
		),
	);
	const writeAccentFx: AppearancePreferences["writeAccentFx"] = Effect.fn(
		"FilesystemAppearancePreferences.writeAccentFx",
	)((accent) =>
		accentWriteSemaphore.withPermits(1)(
			writeElectronPreferenceFx({
				root,
				fileSystem,
				pendingPath: join(root, "appearance-accent.pending"),
				currentPath: accentPath,
				value: accent,
				operation: "persist the appearance accent preference",
				serialize: (value) => AppearanceAccentSchema.parse(value),
			}),
		),
	);
	return {
		readThemeFx: readElectronPreferenceFx({
			fileSystem,
			path: themePath,
			fallback: "dark" as const,
			operation: "read the appearance preference",
			parse: (stored) => AppearanceThemeSchema.safeParse(stored.trim()).data,
		}),
		writeThemeFx,
		readAccentFx: readElectronPreferenceFx({
			fileSystem,
			path: accentPath,
			fallback: "rose" as const,
			operation: "read the appearance accent preference",
			parse: (stored) => AppearanceAccentSchema.safeParse(stored.trim()).data,
		}),
		writeAccentFx,
	} satisfies AppearancePreferences;
});
