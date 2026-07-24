import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { CheatAvailabilityAtom } from "~/bridge/cheat/CheatAvailabilityAtom";

/** Reads the current application cheat availability from the active Atom registry. */
export const readCheatAvailabilitySnapshotFx = Effect.fn("readCheatAvailabilitySnapshotFx")(() =>
	Atom.get(CheatAvailabilityAtom),
);
