import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamily } from "~/bridge/game/makeExactGameAtomFamily";
import { spawnCheatItemFx } from "~/engine/cheat/write/spawnCheatItemFx";

/** Returns the canonical spawn command owned exclusively by one exact live Game. */
export const spawnCheatItemAtom = makeExactGameAtomFamily((game) =>
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
);

type SpawnCheatItemAtom = ReturnType<typeof spawnCheatItemAtom>;
export type SpawnCheatItemAsyncResult =
	SpawnCheatItemAtom extends Atom.Atom<infer Result> ? Result : never;
