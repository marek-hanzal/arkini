import { Effect } from "effect";

import type { TickFxService } from "~/engine/tick/context/TickFx";
import { advanceRuntimeElapsedFx } from "~/engine/tick/internal/advanceRuntimeElapsedFx";
import { makeTickServiceFx } from "~/engine/tick/internal/makeTickServiceFx";

/** Builds the transient Tick service owned by one game core layer. */
export const makeTickFx = Effect.fn("makeTickFx")(function* () {
	const service = yield* makeTickServiceFx({
		advanceRuntimeElapsed: advanceRuntimeElapsedFx,
	});
	return {
		read: service.read,
		advanceRuntime: service.advanceRuntime.pipe(Effect.asVoid),
		advanceRuntimeBy: (elapsedMs) => service.advanceRuntimeBy(elapsedMs).pipe(Effect.asVoid),
	} satisfies TickFxService;
});
