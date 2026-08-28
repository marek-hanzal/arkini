import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/bridge/game/makeExactGameAtomFamilyFx";
import { setInstantGameplayFx } from "~/engine/cheat/write/setInstantGameplayFx";

/** Returns the Instant-gameplay command owned exclusively by one exact live Game. */
export const setInstantGameplayAtom = Effect.runSync(
	makeExactGameAtomFamilyFx((game) =>
		Atom.fn(
			(enabled: boolean) =>
				game.runEngineFx(
					setInstantGameplayFx({
						enabled,
					}),
				),
			{
				concurrent: false,
			},
		).pipe(Atom.setIdleTTL(0)),
	),
);
