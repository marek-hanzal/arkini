import { Context, type Effect } from "effect";

import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export interface RuntimeFxService {
	/**
	 * Reads the current runtime snapshot without exposing its mutable store.
	 */
	readonly read: Effect.Effect<RuntimeSchema.Type>;
}

/**
 * Read-only access to the current hydrated gameplay runtime.
 *
 * All mutations are owned by dedicated atomic runtime commands.
 */
export class RuntimeFx extends Context.Tag("RuntimeFx")<RuntimeFx, RuntimeFxService>() {
	//
}
