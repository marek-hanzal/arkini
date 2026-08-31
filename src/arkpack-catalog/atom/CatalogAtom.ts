import * as Atom from "effect/unstable/reactivity/Atom";
import { ArkpackCatalogOwnerAtom } from "~/arkpack-catalog/atom/ArkpackCatalogOwnerAtom";

/** React projection of the authoritative catalog SubscriptionRef. */
export const CatalogAtom = Atom.subscriptionRef((get) => {
	const catalog = get(ArkpackCatalogOwnerAtom);
	if (catalog === undefined) {
		throw new Error("Arkpack catalog is not configured.");
	}
	return catalog.state;
}).pipe(Atom.keepAlive);
