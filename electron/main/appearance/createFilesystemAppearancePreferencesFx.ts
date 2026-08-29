import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import { AppearanceAccentSchema } from "../../contract/appearance/AppearanceAccentSchema";
import { AppearanceThemeSchema } from "../../contract/appearance/AppearanceThemeSchema";
import type { ElectronMainError } from "../ElectronMainError";
import { readElectronPreferenceFx } from "../preference/readElectronPreferenceFx";
import { writeElectronPreferenceFx } from "../preference/writeElectronPreferenceFx";
import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";

/** Effect-native main-process capability for application-wide appearance preferences. */
export interface AppearancePreferences {
	readonly readThemeFx: Effect.Effect<AppearanceThemeSchema.Type, ElectronMainError>;
	readonly writeThemeFx: (
		theme: AppearanceThemeSchema.Type,
	) => Effect.Effect<void, ElectronMainError>;
	readonly readAccentFx: Effect.Effect<AppearanceAccentSchema.Type, ElectronMainError>;
	readonly writeAccentFx: (
		accent: AppearanceAccentSchema.Type,
	) => Effect.Effect<void, ElectronMainError>;
}

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
	const filesystemWrite = yield* createFilesystemWriteFx().pipe(
		Effect.provideService(FileSystem.FileSystem, fileSystem),
	);
	const themePath = join(root, "appearance.theme.json");
	const accentPath = join(root, "appearance.accent.json");
	const writeThemeFx = Effect.fn("FilesystemAppearancePreferences.writeThemeFx")(
		(theme: AppearanceThemeSchema.Type) =>
			writeElectronPreferenceFx({
				filesystemWrite,
				lock: join(root, ".appearance-theme.lock"),
				target: themePath,
				value: theme,
				operation: "persist the appearance preference",
				serialize: (value) => JSON.stringify(AppearanceThemeSchema.parse(value)),
			}),
	);
	const writeAccentFx = Effect.fn("FilesystemAppearancePreferences.writeAccentFx")(
		(accent: AppearanceAccentSchema.Type) =>
			writeElectronPreferenceFx({
				filesystemWrite,
				lock: join(root, ".appearance-accent.lock"),
				target: accentPath,
				value: accent,
				operation: "persist the appearance accent preference",
				serialize: (value) => JSON.stringify(AppearanceAccentSchema.parse(value)),
			}),
	);
	return {
		readThemeFx: readElectronPreferenceFx({
			fileSystem,
			path: themePath,
			fallback: "dark" as const,
			operation: "read the appearance preference",
			parse: (stored) => {
				try {
					return AppearanceThemeSchema.safeParse(JSON.parse(stored)).data;
				} catch {
					return undefined;
				}
			},
		}),
		writeThemeFx,
		readAccentFx: readElectronPreferenceFx({
			fileSystem,
			path: accentPath,
			fallback: "rose" as const,
			operation: "read the appearance accent preference",
			parse: (stored) => {
				try {
					return AppearanceAccentSchema.safeParse(JSON.parse(stored)).data;
				} catch {
					return undefined;
				}
			},
		}),
		writeAccentFx,
	} satisfies AppearancePreferences;
});
