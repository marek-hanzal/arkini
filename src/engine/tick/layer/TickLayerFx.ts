import { Effect, Layer } from "effect";

import { TickFx, type TickFxService } from "~/engine/tick/context/TickFx";
import { advanceRuntimeElapsedFx } from "~/engine/tick/internal/advanceRuntimeElapsedFx";
import { makeTickServiceFx } from "~/engine/tick/internal/makeTickServiceFx";

const makeTickFx = Effect.fn("makeTickFx")(function* () {
	const service = yield* makeTickServiceFx({
		advanceRuntimeElapsed: advanceRuntimeElapsedFx,
	});
	return {
		read: service.read,
		advanceRuntime: service.advanceRuntime.pipe(Effect.asVoid),
		advanceRuntimeBy: (elapsedMs) => service.advanceRuntimeBy(elapsedMs).pipe(Effect.asVoid),
	} satisfies TickFxService;
});

/** Builds Tick over an already-owned canonical Runtime. */
export const TickLayerFx = Layer.effect(TickFx, makeTickFx());
