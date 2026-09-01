import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ArkpackCatalogOwnerAtom } from "~/arkpack-catalog/atom/ArkpackCatalogOwnerAtom";
import { createArkpackCatalogFx } from "~/arkpack-catalog/fx/createArkpackCatalogFx";

/** Creates and publishes the renderer process's one authoritative Arkpack catalog. */
export const bootstrapArkpackCatalogFx = Effect.fn("bootstrapArkpackCatalogFx")(function* () {
	const catalog = yield* createArkpackCatalogFx();
	yield* Atom.set(ArkpackCatalogOwnerAtom, catalog);
	return catalog;
});
