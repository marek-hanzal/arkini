import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { ArkpackCatalogOwnerAtom } from "~/arkpack/renderer/ArkpackCatalogOwnerAtom";

/** Refreshes the authoritative Arkpack catalog, including files copied in by hand. */
export const refreshArkpackCatalogAtom = Atom.fn(
	(_void: void, get) => {
		const catalog = get(ArkpackCatalogOwnerAtom);
		const refreshFx =
			catalog === undefined
				? Effect.fail(new Error("Arkpack catalog is not configured."))
				: catalog.refreshFx;
		return Effect.yieldNow.pipe(Effect.andThen(refreshFx));
	},
	{
		concurrent: true,
	},
);
