import { Effect, FileSystem } from "effect";
import { join } from "node:path";

import {
	defaultSoundSettings,
	type SoundChannel,
	type SoundSettings,
} from "../../contract/sound/SoundSettings";
import { SoundVolumeSchema } from "../../contract/sound/SoundVolumeSchema";
import type { ElectronMainError } from "../ElectronMainError";
import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";
import { readElectronPreferenceFx } from "../preference/readElectronPreferenceFx";
import { writeElectronPreferenceFx } from "../preference/writeElectronPreferenceFx";

export interface SoundPreferences {
	readonly readFx: Effect.Effect<SoundSettings, ElectronMainError, never>;
	readonly writeFx: (
		channel: SoundChannel,
		volume: SoundVolumeSchema.Type,
	) => Effect.Effect<void, ElectronMainError, never>;
}

export namespace createFilesystemSoundPreferencesFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Creates the three scalar application sound preferences. */
export const createFilesystemSoundPreferencesFx = Effect.fn("createFilesystemSoundPreferencesFx")(
	function* ({ root, fileSystem: providedFileSystem }: createFilesystemSoundPreferencesFx.Props) {
		const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
		const filesystemWrite = yield* createFilesystemWriteFx().pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
		);
		const pathFn = (channel: SoundChannel) => join(root, `sound.${channel}.json`);
		const readChannelFx = (channel: SoundChannel) =>
			readElectronPreferenceFx({
				fileSystem,
				path: pathFn(channel),
				fallback: defaultSoundSettings[channel],
				operation: `read the ${channel} sound preference`,
				parseFn: (stored) => {
					try {
						return SoundVolumeSchema.safeParse(JSON.parse(stored)).data;
					} catch {
						return undefined;
					}
				},
			});
		return {
			readFx: Effect.all({
				master: readChannelFx("master"),
				music: readChannelFx("music"),
				sfx: readChannelFx("sfx"),
			}),
			writeFx: Effect.fn("FilesystemSoundPreferences.writeFx")((channel, volume) =>
				writeElectronPreferenceFx({
					filesystemWrite,
					lock: join(root, `.sound-${channel}.lock`),
					target: pathFn(channel),
					value: volume,
					operation: `persist the ${channel} sound preference`,
					serializeFn: (value) => JSON.stringify(SoundVolumeSchema.parse(value)),
				}),
			),
		} satisfies SoundPreferences;
	},
);
