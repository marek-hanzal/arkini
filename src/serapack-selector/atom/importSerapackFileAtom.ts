import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { SerapackCatalogOwnerAtom } from "~/serapack-catalog/atom/SerapackCatalogOwnerAtom";

/**
 * Imports one file through the authoritative Serapack catalog owner.
 * The catalog Semaphore owns ordering; concurrent mode prevents Atom from cancelling an earlier import.
 */
export const importSerapackFileAtom = Atom.fn(
	(_, get) => {
		const catalog = get(SerapackCatalogOwnerAtom);
		const importFx =
			catalog === undefined
				? Effect.fail(new Error("Serapack catalog is not configured."))
				: catalog.importFileFx();
		// TODO(#397): Remove only after stable Atom guarantees observable pending
		// settlement for a synchronous concurrent command.
		return Effect.yieldNow.pipe(Effect.andThen(importFx));
	},
	{
		concurrent: true,
	},
);
