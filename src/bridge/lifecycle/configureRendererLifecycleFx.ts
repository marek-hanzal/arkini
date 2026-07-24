import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { RendererLifecycle } from "~/bridge/lifecycle/RendererLifecycle";
import { RendererLifecycleOwnerAtom } from "~/bridge/lifecycle/RendererLifecycleOwnerAtom";

/** Publishes the process-owned lifecycle capability before React mounts. */
export const configureRendererLifecycleFx = Effect.fn("configureRendererLifecycleFx")(
	(lifecycle: RendererLifecycle) => Atom.set(RendererLifecycleOwnerAtom, lifecycle),
);
