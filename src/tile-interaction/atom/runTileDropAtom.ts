import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/game-presentation/fx/makeExactGameAtomFamilyFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import type { DropItemCommand } from "~/item-interaction/type/DropItemCommand";

/**
 * Owns mounted-screen tile-drop execution for one exact live Game.
 * The exact engine command/result crosses this seam; the renderer does not
 * choose move, swap or rejection semantics. Concurrent mode prevents one
 * admitted engine command from being interrupted by a later gesture; the
 * scheduling yield stabilizes AsyncResult publication after synchronous
 * pointer-release admission.
 */
export const runTileDropAtom = RendererRuntime.runSync(
	makeExactGameAtomFamilyFx((game) =>
		Atom.fn(
			(command: DropItemCommand) =>
				Effect.yieldNow.pipe(Effect.andThen(game.runFx(dropItemFx(command)))),
			{
				concurrent: true,
			},
		).pipe(Atom.setIdleTTL(0)),
	),
);
