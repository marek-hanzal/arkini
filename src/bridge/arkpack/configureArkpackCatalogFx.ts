import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { ArkpackCatalogOwnerAtom } from "~/bridge/arkpack/ArkpackCatalogOwnerAtom";

/** Configures the renderer registry with its one authoritative catalog owner. */
export const configureArkpackCatalogFx = Effect.fn("configureArkpackCatalogFx")(
	(catalog: ArkpackCatalog) => Atom.set(ArkpackCatalogOwnerAtom, catalog),
);
