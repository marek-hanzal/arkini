import { Data, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { RendererLifecycle } from "~/application-runtime/fx/createRendererLifecycleFx";

/** The renderer process owns exactly one composed Electron lifecycle capability. */
export const RendererLifecycleOwnerAtom = Atom.make<RendererLifecycle | undefined>(undefined).pipe(
	Atom.keepAlive,
);

/** Signals that renderer lifecycle composition did not run before a consumer started. */
export class RendererLifecycleUnavailableError extends Data.TaggedError(
	"RendererLifecycleUnavailableError",
)<{}> {
	override get message(): string {
		return "Arkini Electron lifecycle is unavailable.";
	}
}

/** Reads the exact renderer lifecycle capability configured by the composition root. */
export const readRendererLifecycleFx = Effect.fn("readRendererLifecycleFx")(function* () {
	const lifecycle = yield* Atom.get(RendererLifecycleOwnerAtom);
	if (lifecycle !== undefined) return lifecycle;
	return yield* Effect.fail(new RendererLifecycleUnavailableError());
});
