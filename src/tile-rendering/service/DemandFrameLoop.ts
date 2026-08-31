import type { Effect } from "effect";

export interface DemandFrameLoop {
	/** Requests one render without keeping a continuous frame loop alive. */
	readonly invalidateFx: Effect.Effect<void, never, never>;
	/** Schedules scene-local work for the next owned demand frame and returns its cancellation. */
	readonly scheduleFx: (workFn: () => void) => Effect.Effect<() => void, never, never>;
	/** Schedules scene-local work only after the next owned render has completed. */
	readonly scheduleAfterRenderFx: (workFn: () => void) => Effect.Effect<() => void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
	/** Publishes a fatal failure against the exact Game that owns this loop. */
	readonly reportCriticalFailureFn: (cause: unknown) => void;
}
