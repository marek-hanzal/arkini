import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { ArkpackCatalogOwnerAtom } from "~/bridge/arkpack/ArkpackCatalogOwnerAtom";

/**
 * Imports one file through the authoritative Arkpack catalog owner.
 * The catalog Semaphore owns ordering; concurrent mode prevents Atom from cancelling an earlier import.
 */
export const importArkpackFileAtom = Atom.fn(
	(file: File, get) => {
		const catalog = get(ArkpackCatalogOwnerAtom);
		const importFx =
			catalog === undefined
				? Effect.fail(new Error("Arkpack catalog is not configured."))
				: catalog.importFileFx(file);
		// TODO(#397): Remove only after stable Atom guarantees observable pending
		// settlement for a synchronous concurrent command.
		return Effect.yieldNow.pipe(Effect.andThen(importFx));
	},
	{
		concurrent: true,
	},
);
