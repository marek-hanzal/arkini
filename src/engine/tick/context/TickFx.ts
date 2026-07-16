import { Context, type Effect } from "effect";

import type { advanceRuntimeElapsedFx } from "~/engine/tick/internal/advanceRuntimeElapsedFx";
import type { TickSchema } from "~/engine/tick/schema/TickSchema";

type RuntimeAdvanceFx = ReturnType<typeof advanceRuntimeElapsedFx>;

export interface TickFxService {
	readonly read: Effect.Effect<TickSchema.Type>;
	readonly advanceRuntime: RuntimeAdvanceFx;
	readonly advanceRuntimeBy: (elapsedMs: number) => RuntimeAdvanceFx;
}

/** Owns one failure-safe, at-most-once simulation-time budget for a game session. */
export class TickFx extends Context.Tag("TickFx")<TickFx, TickFxService>() {
	//
}
