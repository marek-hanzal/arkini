import { Context, type Effect } from "effect";

export interface RuntimeSaveFxService {
	/** Stops autosave work and prevents final session disposal from writing state. */
	readonly discard: Effect.Effect<void>;
	/** Persists the latest committed runtime immediately. */
	readonly flush: Effect.Effect<void, unknown>;
}

/** UI/session save coordinator. Gameplay code never depends on this service. */
export class RuntimeSaveFx extends Context.Tag("RuntimeSaveFx")<
	RuntimeSaveFx,
	RuntimeSaveFxService
>() {
	//
}
