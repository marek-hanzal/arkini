import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { SerapackCatalogOwnerAtom } from "~/serapack-catalog/atom/SerapackCatalogOwnerAtom";
import { createSerapackCatalogFx } from "~/serapack-catalog/fx/createSerapackCatalogFx";

/** Creates and publishes the renderer process's one authoritative Serapack catalog. */
export const bootstrapSerapackCatalogFx = Effect.fn("bootstrapSerapackCatalogFx")(function* () {
	const catalog = yield* createSerapackCatalogFx();
	yield* Atom.set(SerapackCatalogOwnerAtom, catalog);
	return catalog;
});
