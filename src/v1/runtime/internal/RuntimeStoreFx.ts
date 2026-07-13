import { Context, type Effect, type Scope, type Stream } from "effect";

import type { CommittedTransitionSchema } from "~/v1/runtime/schema/CommittedTransitionSchema";

export interface RuntimeStoreSubscription {
	readonly current: CommittedTransitionSchema.Type;
	readonly changes: Stream.Stream<CommittedTransitionSchema.Type>;
	readonly shutdown: Effect.Effect<void>;
}

export interface RuntimeStoreFxService {
	readonly read: Effect.Effect<CommittedTransitionSchema.Type>;
	readonly modifyEffect: <Result, Error, Requirements>(
		update: (transition: CommittedTransitionSchema.Type) => Effect.Effect<
			readonly [
				Result,
				CommittedTransitionSchema.Type,
			],
			Error,
			Requirements
		>,
	) => Effect.Effect<Result, Error, Requirements>;
	readonly subscribe: Effect.Effect<RuntimeStoreSubscription, never, Scope.Scope>;
}

/** Internal mutable transition store used only by dedicated runtime services. */
export class RuntimeStoreFx extends Context.Tag("RuntimeStoreFx")<
	RuntimeStoreFx,
	RuntimeStoreFxService
>() {
	//
}
