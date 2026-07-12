import { Effect } from "effect";

import { TickFx } from "~/v1/tick/context/TickFx";

export namespace runTickRuntimeByFx {
	export interface Props {
		elapsedMs: number;
	}
}

/** Advances one deterministic local Tick through the same failure-safe protocol. */
export const runTickRuntimeByFx = Effect.fn("runTickRuntimeByFx")(function* ({
	elapsedMs,
}: runTickRuntimeByFx.Props) {
	yield* (yield* TickFx).advanceRuntimeBy(elapsedMs);
});
