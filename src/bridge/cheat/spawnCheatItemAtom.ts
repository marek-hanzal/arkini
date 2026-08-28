import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/bridge/game/makeExactGameAtomFamilyFx";
import { spawnCheatItemFx } from "~/engine/cheat/write/spawnCheatItemFx";

/** Returns the canonical spawn command owned exclusively by one exact live Game. */
export const spawnCheatItemAtom = Effect.runSync(
	makeExactGameAtomFamilyFx((game) =>
		Atom.fn(
			(itemId: string) =>
				// Let Atom publish the exact AsyncResult without serializing
				// independent engine commands behind the previous spawn.
				Effect.yieldNow.pipe(
					Effect.andThen(
						game.runEngineFx(
							spawnCheatItemFx({
								itemId,
							}),
						),
					),
				),
			{
				concurrent: true,
			},
		).pipe(Atom.setIdleTTL(0)),
	),
);
