import type { AppearanceAccentSchema } from "../../../electron/contract/appearance/AppearanceAccentSchema";
import type { AppearanceThemeSchema } from "../../../electron/contract/appearance/AppearanceThemeSchema";
import * as Atom from "effect/unstable/reactivity/Atom";

/**
 * The renderer-wide authoritative appearance snapshot.
 *
 * Keeping theme and accent together makes startup hydration one atomic publication.
 */
export const AppearanceAtom = Atom.make<{
	readonly theme: AppearanceThemeSchema.Type;
	readonly accent: AppearanceAccentSchema.Type;
}>({
	theme: "dark",
	accent: "rose",
}).pipe(Atom.keepAlive);
