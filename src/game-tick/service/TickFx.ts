import { Context, type Effect } from "effect";

import type { advanceRuntimeElapsedFx } from "~/game-tick/fx/advanceRuntimeElapsedFx";

type RuntimeAdvanceFx =
	ReturnType<typeof advanceRuntimeElapsedFx> extends Effect.Effect<
		unknown,
		infer Error,
		infer Requirements
	>
		? Effect.Effect<void, Error, Requirements>
		: never;

interface TickFxService {
	readonly advanceRuntime: RuntimeAdvanceFx;
}

/** Owns one failure-safe, at-most-once simulation-time budget for a game session. */
export class TickFx extends Context.Service<TickFx, TickFxService>()("TickFx") {
	//
}
