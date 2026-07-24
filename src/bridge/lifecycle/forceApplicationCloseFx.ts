import { Effect } from "effect";
import { readRendererLifecycleFx } from "~/bridge/lifecycle/readRendererLifecycleFx";

/** Forces native close only from the terminal renderer failure boundary. */
export const forceApplicationCloseFx = Effect.fn("forceApplicationCloseFx")(function* () {
	const lifecycle = yield* readRendererLifecycleFx();
	yield* lifecycle.forceCloseFx;
});
