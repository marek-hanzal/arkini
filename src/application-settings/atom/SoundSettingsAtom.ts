import * as Atom from "effect/unstable/reactivity/Atom";

import type { SoundSettings } from "~electron/contract/sound/SoundSettings";

/** Renderer-wide authoritative sound mix shared by Game and Editor preview. */
export const SoundSettingsAtom = Atom.make<SoundSettings>({
	master: 100,
	music: 100,
	sfx: 100,
}).pipe(Atom.keepAlive);
