import * as Atom from "effect/unstable/reactivity/Atom";
import { LauncherAccentReadyAtom } from "~/launcher/atom/LauncherAccentReadyAtom";
import { LauncherHeroReadyAtom } from "~/launcher/atom/LauncherHeroReadyAtom";

/** True once both accent and Hero resource are ready to render. */
export const LauncherVisualReadyAtom = Atom.make(
	(get) => get(LauncherAccentReadyAtom) && get(LauncherHeroReadyAtom),
);
