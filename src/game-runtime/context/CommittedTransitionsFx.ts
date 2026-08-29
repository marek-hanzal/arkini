import { Context, type Effect, type Stream, type SubscriptionRef } from "effect";

import type { CommittedTransitionSchema } from "~/game-runtime/schema/CommittedTransitionSchema";

export interface CommittedTransitionsFxService {
	/** Latest exact canonical committed transition. */
	readonly read: Effect.Effect<CommittedTransitionSchema.Type>;
	/** Synchronous snapshot reserved for explicitly synchronous renderer boundaries. */
	readonly readUnsafe: () => CommittedTransitionSchema.Type;
	/** Replays the latest transition, then every later commit exactly once and in order. */
	readonly changes: Stream.Stream<CommittedTransitionSchema.Type>;
	/** Narrow read/reactivity access; mutation remains internal to RuntimeStoreFx. */
	readonly ref: SubscriptionRef.SubscriptionRef<CommittedTransitionSchema.Type>;
}

/** Read-only access to atomically committed runtime transitions. */
export class CommittedTransitionsFx extends Context.Service<
	CommittedTransitionsFx,
	CommittedTransitionsFxService
>()("CommittedTransitionsFx") {
	//
}
