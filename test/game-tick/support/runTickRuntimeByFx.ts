import { Clock, Effect, Layer } from "effect";

import { TickFx } from "~/game-tick/service/TickFx";

const TickTestClockAdvance = Symbol("TickTestClockAdvance");

interface TickTestClock extends Clock.Clock {
	readonly [TickTestClockAdvance]: (elapsedMs: number) => Effect.Effect<void>;
}

const makeTickTestClockFx = Effect.fn("makeTickTestClockFx")(function* () {
	const liveClock = yield* Clock.Clock;
	let nowMs = 0;
	const readNanosFn = () => BigInt(Math.trunc(nowMs * 1_000_000));
	return {
		currentTimeMillisUnsafe: () => nowMs,
		currentTimeMillis: Effect.sync(() => nowMs),
		currentTimeNanosUnsafe: readNanosFn,
		currentTimeNanos: Effect.sync(readNanosFn),
		monotonicTimeNanosUnsafe: readNanosFn,
		monotonicTimeNanos: Effect.sync(readNanosFn),
		sleep: (duration) => liveClock.sleep(duration),
		[TickTestClockAdvance]: (elapsedMs) =>
			Effect.sync(() => {
				nowMs += elapsedMs;
			}),
	} satisfies TickTestClock;
});

export const TickTestClockLayer = Layer.effect(Clock.Clock, makeTickTestClockFx());

interface RunTickRuntimeByProps {
	readonly elapsedMs: number;
}

/** Advances one deterministic local Tick through the same failure-safe protocol. */
export const runTickRuntimeByFx = Effect.fn("runTickRuntimeByFx")(function* ({
	elapsedMs,
}: RunTickRuntimeByProps) {
	const clock = yield* Clock.Clock;
	if (!(TickTestClockAdvance in clock)) {
		throw new Error("runTickRuntimeByFx requires the test-owned Tick clock.");
	}
	yield* (clock as TickTestClock)[TickTestClockAdvance](elapsedMs);
	yield* (yield* TickFx).advanceRuntime;
});
