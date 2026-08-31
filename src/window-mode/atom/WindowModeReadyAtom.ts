import * as Atom from "effect/unstable/reactivity/Atom";

/** Whether persisted or Electron-confirmed native window mode already owns the live projection. */
export const WindowModeReadyAtom = Atom.make(false).pipe(Atom.keepAlive);
