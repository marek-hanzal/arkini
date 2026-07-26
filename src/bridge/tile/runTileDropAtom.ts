import { Effect } from "effect";
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
 * choose move, swap or rejection semantics. Concurrent mode prevents one
 * admitted engine command from being interrupted by a later gesture; the
 * scheduling yield only stabilizes AsyncResult publication.
 */
export const runTileDropAtom = RendererRuntime.runSync(
	makeExactGameAtomFamilyFx((game) =>
		Atom.fn(
			(command: runTileDropAtom.Command) =>
				Effect.yieldNow.pipe(Effect.andThen(game.runFx(dropItemFx(command)))),
			{
				concurrent: true,
			},
		).pipe(Atom.setIdleTTL(0)),
	),
);
