import { Context, type SubscriptionRef } from "effect";

import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

/** Internal mutable runtime store used only by dedicated runtime commands. */
export class RuntimeStoreFx extends Context.Tag("RuntimeStoreFx")<
	RuntimeStoreFx,
	SubscriptionRef.SubscriptionRef<RuntimeSchema.Type>
>() {
	//
}
