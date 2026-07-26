import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/bridge/game/makeExactGameAtomFamilyFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { releaseInventoryItemFx } from "~/engine/runtime/write/releaseInventoryItemFx";

export namespace runInventoryReleaseAtom {
	export type Command = releaseInventoryItemFx.Props;
}

/**
 * Owns mounted Inventory release execution for one exact live Game.
 * Placement and resulting inventory semantics remain entirely engine-owned.
 */
export const runInventoryReleaseAtom = RendererRuntime.runSync(
	makeExactGameAtomFamilyFx((game) =>
		Atom.fn((command: runInventoryReleaseAtom.Command) =>
			game.runFx(releaseInventoryItemFx(command)),
		).pipe(Atom.setIdleTTL(0)),
	),
);
