import { Context, type Effect } from "effect";

import type { TickPerformance } from "~/game-tick/type/TickPerformance";
import type { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { RuntimeStoreFx } from "~/game-runtime/context/RuntimeStoreFx";
import type { AdvanceRuntimeElapsedError } from "~/game-tick/fx/advanceRuntimeElapsedFx";

type RuntimeAdvanceFx = Effect.Effect<
	number,
	AdvanceRuntimeElapsedError,
	RuntimeStoreFx | GameConfigFx
>;

interface TickFxService {
	/** Advances due simulation work and returns milliseconds until the next wake. */
	readonly advanceRuntime: RuntimeAdvanceFx;
	/** Observes aggregated costs at most once per second; unsubscribe releases the listener. */
	readonly subscribePerformanceFn: (listenerFn: (sample: TickPerformance) => void) => () => void;
}

/** Owns one failure-safe, at-most-once simulation-time budget for a game session. */
export class TickFx extends Context.Service<TickFx, TickFxService>()("TickFx") {
	//
}
