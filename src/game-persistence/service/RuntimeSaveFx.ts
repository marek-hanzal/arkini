import { Context, type Effect } from "effect";

import type { StateSchema } from "~/game-persistence/schema/StateSchema";

interface RuntimeSaveFxService {
	/** Writes an explicit snapshot under the autosave lock, even when unchanged. */
	readonly saveSnapshotFx: (
		writeFx: (state: StateSchema.Type) => Effect.Effect<void, unknown>,
	) => Effect.Effect<void, unknown>;
	/** Stops autosave work and prevents final session disposal from writing state. */
	readonly discard: Effect.Effect<void, never, never>;
	/** Persists the latest committed runtime immediately. */
	readonly flush: Effect.Effect<void, unknown, never>;
}

/** UI/session save coordinator. Gameplay code never depends on this service. */
export class RuntimeSaveFx extends Context.Service<RuntimeSaveFx, RuntimeSaveFxService>()(
	"RuntimeSaveFx",
) {
	//
}
