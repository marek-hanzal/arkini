import * as Atom from "effect/unstable/reactivity/Atom";

/** Presentation-owned completion fact used by the root route redirect. */
export const LauncherSplashCompletedAtom = Atom.make(false).pipe(Atom.keepAlive);
