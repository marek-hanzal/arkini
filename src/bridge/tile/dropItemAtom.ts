import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamily } from "~/bridge/game/makeExactGameAtomFamily";
import { dropItemFx } from "~/engine/runtime/write/dropItemFx";

export namespace dropItemAtom {
	export type Props = dropItemFx.Props;
	export type Result = dropItemFx.Result;
}

/** Runs one atomic item drop through one exact live Game command runtime. */
export const dropItemAtom = makeExactGameAtomFamily((game) =>
	Atom.fn((props: dropItemAtom.Props) => game.runFx(dropItemFx(props)), {
		concurrent: false,
	}).pipe(Atom.setIdleTTL(0)),
);
