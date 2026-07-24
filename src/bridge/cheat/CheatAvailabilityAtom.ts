import * as Atom from "effect/unstable/reactivity/Atom";

/** The one renderer-wide published value controlling application cheat tooling. */
export const CheatAvailabilityAtom = Atom.make(false).pipe(Atom.keepAlive);
