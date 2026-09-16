import { Effect, Semaphore } from "effect";

import type { SoundChannel } from "~electron/contract/sound/SoundSettings";
import type { SoundVolumeSchema } from "~electron/contract/sound/SoundVolumeSchema";

const writeSemaphore = Semaphore.makeUnsafe(1);

/** Persists sound changes in renderer admission order. */
export const writeSoundVolumeFx = Effect.fn("writeSoundVolumeFx")(
	(channel: SoundChannel, volume: SoundVolumeSchema.Type) =>
		writeSemaphore.withPermits(1)(
			Effect.tryPromise({
				try: () => window.arkini.sound.writeFn(channel, volume),
				catch: (cause) => cause,
			}),
		),
);
