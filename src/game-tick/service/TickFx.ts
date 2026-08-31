import { Context, type Effect } from "effect";

import type { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { RuntimeStoreFx } from "~/game-runtime/context/RuntimeStoreFx";
import type { AdvanceRuntimeElapsedError } from "~/game-tick/fx/advanceRuntimeElapsedFx";

type RuntimeAdvanceFx = Effect.Effect<
	void,
	AdvanceRuntimeElapsedError,
	RuntimeStoreFx | GameConfigFx
>;

interface TickFxService {
	readonly advanceRuntime: RuntimeAdvanceFx;
}

/** Owns one failure-safe, at-most-once simulation-time budget for a game session. */
export class TickFx extends Context.Service<TickFx, TickFxService>()("TickFx") {
	//
}
