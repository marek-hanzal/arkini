import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/bridge/game/makeExactGameAtomFamilyFx";
import { dropItemFx } from "~/engine/runtime/write/dropItemFx";

export namespace dropItemAtom {
	export type Props = dropItemFx.Props;
	export type Result = dropItemFx.Result;
}

/** Runs one atomic item drop through one exact live Game command runtime. */
export const dropItemAtom = Effect.runSync(
	makeExactGameAtomFamilyFx((game) =>
		Atom.fn((props: dropItemAtom.Props) => game.runFx(dropItemFx(props)), {
			concurrent: false,
		}).pipe(Atom.setIdleTTL(0)),
	),
);
