import type { AppearanceAccentSchema } from "~electron/contract/appearance/AppearanceAccentSchema";
import * as Atom from "effect/unstable/reactivity/Atom";

/** The renderer-wide accent, hydrated once from its persisted preference. */
export const AccentAtom = Atom.make<AppearanceAccentSchema.Type>("rose").pipe(Atom.keepAlive);
