import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { SerapackCatalogOwnerAtom } from "~/serapack-catalog/atom/SerapackCatalogOwnerAtom";

/** Refreshes the authoritative Serapack catalog, including files copied in by hand. */
export const refreshSerapackCatalogAtom = Atom.fn(
	(_void: void, get) => {
		const catalog = get(SerapackCatalogOwnerAtom);
		const refreshFx =
			catalog === undefined
				? Effect.fail(new Error("Serapack catalog is not configured."))
				: catalog.refreshFx;
		return Effect.yieldNow.pipe(Effect.andThen(refreshFx));
	},
	{
		concurrent: true,
	},
);
