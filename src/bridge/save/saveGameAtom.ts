import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamily } from "~/bridge/game/makeExactGameAtomFamily";
import { RuntimeSaveFx } from "~/bridge/save/RuntimeSaveFx";

/** Returns one explicit-save command for one exact live Game object identity. */
export const saveGameAtom = makeExactGameAtomFamily((game) =>
	Atom.fn(
		(_input: void) =>
			game.runFx(RuntimeSaveFx.pipe(Effect.flatMap((service) => service.flush))),
		{
			concurrent: false,
		},
	).pipe(Atom.setIdleTTL(0)),
);
