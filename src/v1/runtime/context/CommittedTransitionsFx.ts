import { Context, type Effect, type Scope, type Stream } from "effect";

import type { CommittedTransitionSchema } from "~/v1/runtime/schema/CommittedTransitionSchema";

export interface CommittedTransitionSubscription {
	/** Current committed transition captured atomically with the following changes stream. */
	readonly current: CommittedTransitionSchema.Type;
	/** Every successful commit after `current`, in commit order. */
	readonly changes: Stream.Stream<CommittedTransitionSchema.Type>;
	/** Stops this subscription immediately; its owning scope still releases resources. */
	readonly shutdown: Effect.Effect<void>;
}

export interface CommittedTransitionsFxService {
	/**
	 * Opens one scoped subscription without a gap between the current value and
	 * subsequent commits.
	 */
	readonly subscribe: Effect.Effect<CommittedTransitionSubscription, never, Scope.Scope>;
}

/** Read-only access to atomically committed runtime transitions. */
export class CommittedTransitionsFx extends Context.Tag("CommittedTransitionsFx")<
	CommittedTransitionsFx,
	CommittedTransitionsFxService
>() {
	//
}
