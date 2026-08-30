import * as Atom from "effect/unstable/reactivity/Atom";
import { Effect } from "effect";

import { makeExactGameAtomFamilyFx } from "~/ui/game/makeExactGameAtomFamilyFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { releaseInventoryItemFx } from "~/item-interaction/fx/releaseInventoryItemFx";

type Command = releaseInventoryItemFx.Props;

/**
 * Owns mounted Inventory release execution for one exact live Game.
 * Placement and resulting inventory semantics remain entirely engine-owned.
 * Concurrent mode prevents rapid releases from interrupting each other; the
 * scheduling yield only stabilizes per-command AsyncResult publication.
 */
export const runInventoryReleaseAtom = RendererRuntime.runSync(
	makeExactGameAtomFamilyFx((game) =>
		Atom.fn(
			(command: Command) =>
				Effect.yieldNow.pipe(Effect.andThen(game.runFx(releaseInventoryItemFx(command)))),
			{
				concurrent: true,
			},
		).pipe(Atom.setIdleTTL(0)),
	),
);
