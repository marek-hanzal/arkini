import type { Effect } from "effect";

export interface DemandFrameLoop {
	/** Requests one render without keeping a continuous frame loop alive. */
	readonly invalidateFx: Effect.Effect<void>;
	/** Schedules scene-local work for the next owned demand frame and returns its cancellation. */
	readonly scheduleFx: (work: () => void) => Effect.Effect<() => void>;
	readonly closeFx: Effect.Effect<void>;
	/** Publishes a fatal failure against the exact Game that owns this loop. */
	readonly reportCriticalFailure: (cause: unknown) => void;
}
