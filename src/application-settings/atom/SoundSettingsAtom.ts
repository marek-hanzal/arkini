import * as Atom from "effect/unstable/reactivity/Atom";

import { defaultSoundSettings, type SoundSettings } from "~electron/contract/sound/SoundSettings";

/** Renderer-wide authoritative sound mix shared by Game and Editor preview. */
export const SoundSettingsAtom = Atom.make<SoundSettings>(defaultSoundSettings).pipe(
	Atom.keepAlive,
);
