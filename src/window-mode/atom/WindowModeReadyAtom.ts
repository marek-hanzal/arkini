import * as Atom from "effect/unstable/reactivity/Atom";

/** Whether Electron has supplied the saved window-mode preference for the live projection. */
export const WindowModeReadyAtom = Atom.make(false).pipe(Atom.keepAlive);
