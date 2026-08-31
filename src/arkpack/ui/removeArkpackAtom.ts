import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { ArkpackCatalogOwnerAtom } from "~/arkpack-catalog/atom/ArkpackCatalogOwnerAtom";

/**
 * Removes one package through the authoritative Arkpack catalog owner.
 * The catalog Semaphore owns ordering; concurrent mode prevents Atom from cancelling an earlier removal.
 */
export const removeArkpackAtom = Atom.fn(
	(packageId: string, get) => {
		const catalog = get(ArkpackCatalogOwnerAtom);
		const removeFx =
			catalog === undefined
				? Effect.fail(new Error("Arkpack catalog is not configured."))
				: catalog.removeFx(packageId);
		// TODO(#397): Remove only after stable Atom guarantees observable pending
		// settlement for a synchronous concurrent command.
		return Effect.yieldNow.pipe(Effect.andThen(removeFx));
	},
	{
		concurrent: true,
	},
);
