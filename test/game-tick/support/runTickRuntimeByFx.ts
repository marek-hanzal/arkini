import { Effect } from "effect";

import { TickFx } from "~/game-tick/service/TickFx";

interface RunTickRuntimeByProps {
	readonly elapsedMs: number;
}

/** Advances one deterministic local Tick through the same failure-safe protocol. */
export const runTickRuntimeByFx = Effect.fn("runTickRuntimeByFx")(function* ({
	elapsedMs,
}: RunTickRuntimeByProps) {
	yield* (yield* TickFx).advanceRuntimeBy(elapsedMs);
});
