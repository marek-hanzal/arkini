import { Clock, Effect } from "effect";

import { TickFx } from "~/v1/tick/context/TickFx";

/** Captures one real-time tick from Effect Clock and updates TickFx. */
export const pulseTickFx = Effect.fn("pulseTickFx")(function* () {
	const service = yield* TickFx;
	const previous = yield* service.read;
	const nowMs = yield* Clock.currentTimeMillis;
	const tick = {
		nowMs,
		elapsedMs: Math.max(0, nowMs - previous.nowMs),
	};
	yield* service.set(tick);
	return tick;
});
