import * as Atom from "effect/unstable/reactivity/Atom";
import type { WindowModeSchema } from "../../../electron/contract/window/WindowModeSchema";

/** Renderer mirror of the Electron-confirmed global native window mode. */
export const WindowModeAtom = Atom.make<WindowModeSchema.Type>("default").pipe(Atom.keepAlive);
