import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { dropItemAtom } from "~/bridge/tile/dropItemAtom";

/** Adapts one controllable test Promise edge into the production command Atom shape. */
export const makeDropItemTestAtom = (
	drop: (props: dropItemAtom.Props) => Promise<dropItemAtom.Result>,
) =>
	Atom.fn(
		(props: dropItemAtom.Props) =>
			Effect.tryPromise({
				try: () => drop(props),
				catch: (cause) => cause,
			}),
		{
			concurrent: false,
		},
	).pipe(Atom.setIdleTTL(0));
