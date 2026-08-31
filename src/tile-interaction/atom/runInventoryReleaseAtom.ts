import * as Atom from "effect/unstable/reactivity/Atom";
import { Effect } from "effect";

import { makeExactGameAtomFamilyFx } from "~/game-presentation/fx/makeExactGameAtomFamilyFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { releaseInventoryItemFx } from "~/item-interaction/fx/releaseInventoryItemFx";

/**
 * Owns mounted Inventory release execution for one exact live Game.
 * Placement and resulting inventory semantics remain entirely engine-owned.
 * Concurrent mode prevents rapid releases from interrupting each other; the
 * scheduling yield only stabilizes per-command AsyncResult publication.
 */
export const runInventoryReleaseAtom = RendererRuntime.runSync(
	makeExactGameAtomFamilyFx((game) =>
		Atom.fn(
			(command: releaseInventoryItemFx.Props) =>
				Effect.yieldNow.pipe(Effect.andThen(game.runFx(releaseInventoryItemFx(command)))),
			{
				concurrent: true,
			},
		).pipe(Atom.setIdleTTL(0)),
	),
);
