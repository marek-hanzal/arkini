import { Context, type Ref } from "effect";

import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

/**
 * Provides an atomic mutable reference to the current hydrated gameplay runtime.
 */
export class RuntimeFx extends Context.Tag("RuntimeFx")<RuntimeFx, Ref.Ref<RuntimeSchema.Type>>() {
	//
}
