import { Context } from "effect";

import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

/**
 * Provides the current hydrated gameplay runtime to gameplay effects.
 */
export class RuntimeFx extends Context.Tag("RuntimeFx")<RuntimeFx, RuntimeSchema.Type>() {
	//
}
