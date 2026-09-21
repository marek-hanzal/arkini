import * as Atom from "effect/unstable/reactivity/Atom";
import type { WindowModeSchema } from "~electron/contract/window/WindowModeSchema";

/** Live projection of the saved global window-mode preference; native application is best effort. */
export const WindowModeAtom = Atom.make<WindowModeSchema.Type>("default").pipe(Atom.keepAlive);
