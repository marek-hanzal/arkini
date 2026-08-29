import { Effect, Layer } from "effect";

import { TickFx } from "~/game-tick/TickFx";
import { advanceRuntimeElapsedFx } from "~/game-tick/advanceRuntimeElapsedFx";
import { makeTickServiceFx } from "~/game-tick/makeTickServiceFx";

const makeTickFx = Effect.fn("makeTickFx")(function* () {
	const service = yield* makeTickServiceFx({
		advanceRuntimeElapsed: advanceRuntimeElapsedFx,
	});
	return {
		read: service.read,
		advanceRuntime: service.advanceRuntime.pipe(Effect.asVoid),
		advanceRuntimeBy: (elapsedMs: number) =>
			service.advanceRuntimeBy(elapsedMs).pipe(Effect.asVoid),
	};
});

/** Builds Tick over an already-owned canonical Runtime. */
export const TickLayerFx = Layer.effect(TickFx, makeTickFx());
