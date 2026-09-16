import { Effect } from "effect";

import type { SoundSettings } from "~electron/contract/sound/SoundSettings";
import { SoundVolumeSchema } from "~electron/contract/sound/SoundVolumeSchema";

/** Reads and validates the complete application sound mix. */
export const readSoundSettingsFx = Effect.fn("readSoundSettingsFx")(() =>
	Effect.tryPromise({
		try: async () => {
			const candidate = await window.arkini.sound.readFn();
			return {
				master: SoundVolumeSchema.parse(candidate.master),
				music: SoundVolumeSchema.parse(candidate.music),
				sfx: SoundVolumeSchema.parse(candidate.sfx),
			} satisfies SoundSettings;
		},
		catch: (cause) => cause,
	}),
);
