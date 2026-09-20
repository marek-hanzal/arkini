import * as Atom from "effect/unstable/reactivity/Atom";
import type { SerapackCatalog } from "~/serapack-catalog/service/SerapackCatalog";

/** The configured identity of the renderer's one authoritative Serapack catalog owner. */
export const SerapackCatalogOwnerAtom = Atom.make<SerapackCatalog | undefined>(undefined).pipe(
	Atom.keepAlive,
);
