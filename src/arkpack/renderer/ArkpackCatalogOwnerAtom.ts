import * as Atom from "effect/unstable/reactivity/Atom";
import type { ArkpackCatalog } from "~/arkpack/renderer/ArkpackCatalog";

/** The configured identity of the renderer's one authoritative Arkpack catalog owner. */
export const ArkpackCatalogOwnerAtom = Atom.make<ArkpackCatalog | undefined>(undefined).pipe(
	Atom.keepAlive,
);
