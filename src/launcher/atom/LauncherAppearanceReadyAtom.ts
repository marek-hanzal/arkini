import * as Atom from "effect/unstable/reactivity/Atom";

/** Whether persisted appearance has been published to the live appearance Atom. */
export const LauncherAppearanceReadyAtom = Atom.make(false).pipe(Atom.keepAlive);
