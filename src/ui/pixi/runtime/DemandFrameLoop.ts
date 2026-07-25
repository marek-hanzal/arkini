import type { Effect } from "effect";

export interface DemandFrameLoop {
	/** Requests one render without keeping a continuous frame loop alive. */
	readonly invalidateFx: Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
