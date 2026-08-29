import * as Atom from "effect/unstable/reactivity/Atom";
import type { RendererLifecycle } from "~/renderer/lifecycle/RendererLifecycle";

/** The renderer process owns exactly one composed Electron lifecycle capability. */
export const RendererLifecycleOwnerAtom = Atom.make<RendererLifecycle | undefined>(undefined).pipe(
	Atom.keepAlive,
);
