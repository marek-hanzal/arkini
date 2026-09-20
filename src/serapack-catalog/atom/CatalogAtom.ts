import * as Atom from "effect/unstable/reactivity/Atom";
import { SerapackCatalogOwnerAtom } from "~/serapack-catalog/atom/SerapackCatalogOwnerAtom";

/** React projection of the authoritative catalog SubscriptionRef. */
export const CatalogAtom = Atom.subscriptionRef((get) => {
	const catalog = get(SerapackCatalogOwnerAtom);
	if (catalog === undefined) {
		throw new Error("Serapack catalog is not configured.");
	}
	return catalog.state;
}).pipe(Atom.keepAlive);
