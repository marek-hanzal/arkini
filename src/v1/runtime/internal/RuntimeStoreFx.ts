import { Context, type SubscriptionRef } from "effect";

import type { CommittedTransitionSchema } from "~/v1/runtime/schema/CommittedTransitionSchema";

/** Internal mutable transition store used only by dedicated runtime commands. */
export class RuntimeStoreFx extends Context.Tag("RuntimeStoreFx")<
	RuntimeStoreFx,
	SubscriptionRef.SubscriptionRef<CommittedTransitionSchema.Type>
>() {
	//
}
