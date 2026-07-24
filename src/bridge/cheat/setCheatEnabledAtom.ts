import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamily } from "~/bridge/game/makeExactGameAtomFamily";
import { setCheatEnabledFx } from "~/engine/cheat/write/setCheatEnabledFx";

/** Returns the Cheat-mode command owned exclusively by one exact live Game. */
export const setCheatEnabledAtom = makeExactGameAtomFamily((game) =>
	Atom.fn(
		(enabled: boolean) =>
			game.runFx(
				setCheatEnabledFx({
					enabled,
				}),
			),
		{
			concurrent: false,
		},
	).pipe(Atom.setIdleTTL(0)),
);
