import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/bridge/game/makeExactGameAtomFamilyFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { dropItemFx } from "~/engine/runtime/write/dropItemFx";

export namespace runTileDropAtom {
	export type Command = dropItemFx.Props;
	export type Result = dropItemFx.Result;
}

/**
 * Owns mounted-screen tile-drop execution for one exact live Game.
 * The exact engine command/result crosses this seam; the renderer does not
 * choose move, swap or rejection semantics.
 */
export const runTileDropAtom = RendererRuntime.runSync(
	makeExactGameAtomFamilyFx((game) =>
		Atom.fn((command: runTileDropAtom.Command) => game.runFx(dropItemFx(command))).pipe(
			Atom.setIdleTTL(0),
		),
	),
);
