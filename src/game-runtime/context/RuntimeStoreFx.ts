import { Context, type Effect, type Stream, type SubscriptionRef } from "effect";

import type { CommittedTransitionSchema } from "~/game-runtime/schema/CommittedTransitionSchema";

export interface RuntimeStoreFxService {
	/** Authoritative transition reference. Gameplay code must mutate through `modifyEffect`. */
	readonly ref: SubscriptionRef.SubscriptionRef<CommittedTransitionSchema.Type>;
	readonly read: Effect.Effect<CommittedTransitionSchema.Type, never, never>;
	/** Synchronous snapshot reserved for explicitly synchronous renderer boundaries. */
	readonly readUnsafeFn: () => CommittedTransitionSchema.Type;
	/** Replays the latest transition, then every later commit in order. */
	readonly changes: Stream.Stream<CommittedTransitionSchema.Type>;
	readonly modifyEffectFx: <Result, Error, Requirements>(
		updateFx: (transition: CommittedTransitionSchema.Type) => Effect.Effect<
			readonly [
				Result,
				CommittedTransitionSchema.Type,
			],
			Error,
			Requirements
		>,
	) => Effect.Effect<Result, Error, Requirements>;
}

/** Internal mutable transition store used only by dedicated runtime services. */
export class RuntimeStoreFx extends Context.Service<RuntimeStoreFx, RuntimeStoreFxService>()(
	"RuntimeStoreFx",
) {
	//
}
