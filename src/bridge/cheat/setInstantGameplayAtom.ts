import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamily } from "~/bridge/game/makeExactGameAtomFamily";
import { setInstantGameplayFx } from "~/engine/cheat/write/setInstantGameplayFx";

/** Returns the Instant-gameplay command owned exclusively by one exact live Game. */
export const setInstantGameplayAtom = makeExactGameAtomFamily((game) =>
	Atom.fn(
		(enabled: boolean) =>
			game.runFx(
				setInstantGameplayFx({
					enabled,
				}),
			),
		{
			concurrent: false,
		},
	).pipe(Atom.setIdleTTL(0)),
);
