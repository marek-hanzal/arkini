import * as Atom from "effect/unstable/reactivity/Atom";
import { LauncherAppearanceReadyAtom } from "~/launcher/atom/LauncherAppearanceReadyAtom";
import { LauncherHeroReadyAtom } from "~/launcher/atom/LauncherHeroReadyAtom";

/** True once both DOM appearance input and Hero resource are ready to render. */
export const LauncherVisualReadyAtom = Atom.make(
	(get) => get(LauncherAppearanceReadyAtom) && get(LauncherHeroReadyAtom),
);
