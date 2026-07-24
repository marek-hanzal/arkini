import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { RendererLifecycleOwnerAtom } from "~/bridge/lifecycle/RendererLifecycleOwnerAtom";
import { RendererLifecycleUnavailableError } from "~/bridge/lifecycle/RendererLifecycleUnavailableError";

/** Reads the exact renderer lifecycle capability configured by the composition root. */
export const readRendererLifecycleFx = Effect.fn("readRendererLifecycleFx")(function* () {
	const lifecycle = yield* Atom.get(RendererLifecycleOwnerAtom);
	if (lifecycle !== undefined) return lifecycle;
	return yield* Effect.fail(new RendererLifecycleUnavailableError());
});
