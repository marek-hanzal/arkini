import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import { CheatAvailabilitySchema } from "../../contract/cheat/CheatAvailabilitySchema";
import type { ElectronMainError } from "../ElectronMainError";
import { readElectronPreferenceFx } from "../preference/readElectronPreferenceFx";
import { writeElectronPreferenceFx } from "../preference/writeElectronPreferenceFx";
import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";

/** Effect-native main-process capability for application-wide cheat-tool availability. */
export interface CheatPreferences {
	readonly readAvailableFx: Effect.Effect<CheatAvailabilitySchema.Type, ElectronMainError>;
	readonly writeAvailableFx: (
		available: CheatAvailabilitySchema.Type,
	) => Effect.Effect<void, ElectronMainError>;
}

export namespace createFilesystemCheatPreferencesFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Creates one narrow Effect-native capability over application-wide cheat preferences. */
export const createFilesystemCheatPreferencesFx = Effect.fn("createFilesystemCheatPreferencesFx")(
	function* ({ root, fileSystem: providedFileSystem }: createFilesystemCheatPreferencesFx.Props) {
		const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
		const currentPath = join(root, "cheats.available.json");
		const filesystemWrite = yield* createFilesystemWriteFx().pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
		);
		const writeAvailableFx = Effect.fn("FilesystemCheatPreferences.writeAvailableFx")(
			(available: CheatAvailabilitySchema.Type) =>
				writeElectronPreferenceFx({
					filesystemWrite,
					lock: join(root, ".cheats-available.lock"),
					target: currentPath,
					value: available,
					operation: "persist the cheat availability preference",
					serialize: (value) => JSON.stringify(CheatAvailabilitySchema.parse(value)),
				}),
		);
		return {
			readAvailableFx: readElectronPreferenceFx({
				fileSystem,
				path: currentPath,
				fallback: false,
				operation: "read the cheat availability preference",
				parse: (stored) => {
					try {
						return CheatAvailabilitySchema.safeParse(JSON.parse(stored)).data;
					} catch {
						return undefined;
					}
				},
			}),
			writeAvailableFx,
		} satisfies CheatPreferences;
	},
);
