import * as Atom from "effect/unstable/reactivity/Atom";
import type { WindowMode } from "~/bridge/window/WindowMode";

/** Renderer mirror of the Electron-confirmed global native window mode. */
export const WindowModeAtom = Atom.make<WindowMode>("default").pipe(Atom.keepAlive);
