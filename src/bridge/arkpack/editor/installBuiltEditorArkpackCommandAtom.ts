import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { buildEditorProjectFx } from "~/bridge/arkpack/editor/buildEditorProjectFx";
import { ArkpackCatalogOwnerAtom } from "~/bridge/arkpack/ArkpackCatalogOwnerAtom";

/** Installs exact build bytes through the authoritative catalog owner. */
export const installBuiltEditorArkpackCommandAtom = Atom.family((contentHash: string) =>
	Atom.fn((artifact: buildEditorProjectFx.Success, get) => {
		if (artifact.contentHash !== contentHash) {
			return Effect.fail(new Error("The selected editor build artifact is stale."));
		}
		const catalog = get(ArkpackCatalogOwnerAtom);
		return catalog === undefined
			? Effect.fail(new Error("Arkpack catalog is not configured."))
			: catalog.installFx({
					bytes: artifact.bytes,
					filename: artifact.filename,
				});
	}).pipe(Atom.setIdleTTL(0)),
);
