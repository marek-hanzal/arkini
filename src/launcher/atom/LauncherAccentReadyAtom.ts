import * as Atom from "effect/unstable/reactivity/Atom";

/** Whether the persisted accent has been published to the live Atom. */
export const LauncherAccentReadyAtom = Atom.make(false).pipe(Atom.keepAlive);
