import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { SoundChannel } from "~electron/contract/sound/SoundSettings";
import { SoundVolumeSchema } from "~electron/contract/sound/SoundVolumeSchema";
import { writeSoundVolumeFx } from "~/application-settings/fx/writeSoundVolumeFx";
import { SoundSettingsAtom } from "./SoundSettingsAtom";

/** Persists one sound bus and publishes it to every live audio consumer. */
export const setSoundVolumeAtom = Atom.fn(
	({ channel, volume }: { readonly channel: SoundChannel; readonly volume: number }) =>
		Effect.gen(function* () {
			const parsed = SoundVolumeSchema.parse(volume);
			const current = yield* Atom.get(SoundSettingsAtom);
			yield* Atom.set(SoundSettingsAtom, {
				...current,
				[channel]: parsed,
			});
			yield* writeSoundVolumeFx(channel, parsed);
		}),
	{
		concurrent: true,
	},
).pipe(Atom.setIdleTTL(0));
