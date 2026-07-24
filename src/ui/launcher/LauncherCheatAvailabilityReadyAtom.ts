import * as Atom from "effect/unstable/reactivity/Atom";

/** Whether persisted cheat availability has been published exactly once. */
export const LauncherCheatAvailabilityReadyAtom = Atom.make(false).pipe(Atom.keepAlive);
