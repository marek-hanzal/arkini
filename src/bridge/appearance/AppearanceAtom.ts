import type { AppearanceAccent } from "~/bridge/appearance/AppearanceAccent";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import * as Atom from "effect/unstable/reactivity/Atom";

/**
 * The renderer-wide authoritative appearance snapshot.
 *
 * Keeping theme and accent together makes startup hydration one atomic publication.
 */
export const AppearanceAtom = Atom.make<{
	readonly theme: AppearanceTheme;
	readonly accent: AppearanceAccent;
}>({
	theme: "dark",
	accent: "rose",
}).pipe(Atom.keepAlive);
