import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/bridge/game/makeExactGameAtomFamilyFx";
import { spawnCheatItemFx } from "~/engine/cheat/write/spawnCheatItemFx";

/** Returns the canonical spawn command owned exclusively by one exact live Game. */
export const spawnCheatItemAtom = Effect.runSync(
	makeExactGameAtomFamilyFx((game) =>
		Atom.fn(
			(itemId: string) =>
				game.runFx(
					spawnCheatItemFx({
						itemId,
					}),
				),
			{
				concurrent: false,
			},
		).pipe(Atom.setIdleTTL(0)),
	),
);
