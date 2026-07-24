import { Effect } from "effect";
import { readRendererLifecycleFx } from "~/bridge/lifecycle/readRendererLifecycleFx";

/** Requests the trusted native close handshake; final-save failure does not keep the window open. */
export const requestApplicationCloseFx = Effect.fn("requestApplicationCloseFx")(function* () {
	const lifecycle = yield* readRendererLifecycleFx();
	yield* lifecycle.requestCloseFx;
});
