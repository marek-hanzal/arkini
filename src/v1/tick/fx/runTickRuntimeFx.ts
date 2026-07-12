import { Effect } from "effect";

import { TickFx } from "~/v1/tick/context/TickFx";

/** Captures real time from Effect Clock and advances it at most once. */
export const runTickRuntimeFx = Effect.fn("runTickRuntimeFx")(function* () {
	yield* (yield* TickFx).advanceRuntime;
});
