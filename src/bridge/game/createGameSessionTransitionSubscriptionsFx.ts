import { Effect, ExecutionStrategy, Exit, Scope, Stream } from "effect";

import { invokeExternalCallbackFx } from "~/engine/common/fx/invokeExternalCallbackFx";
import type { GameEventBatchSchema } from "~/engine/event/schema/GameEventBatchSchema";
import type { CommittedTransitionSchema } from "~/engine/runtime/schema/CommittedTransitionSchema";
import {
	type CommittedTransitionSubscription,
	CommittedTransitionsFx,
	type CommittedTransitionsFxService,
} from "~/engine/runtime/context/CommittedTransitionsFx";

export interface GameSessionTransitionSubscriptionCleanup {
	readonly shutdown: Effect.Effect<void>;
	readonly release: Effect.Effect<void>;
}

export interface GameSessionTransitionSubscriptions {
	readonly subscribe: (
		listener: () => void | PromiseLike<void>,
	) => Effect.Effect<GameSessionTransitionSubscriptionCleanup>;
	readonly subscribeTransitions: (
		listener: (transition: CommittedTransitionSchema.Type) => void | PromiseLike<void>,
	) => Effect.Effect<GameSessionTransitionSubscriptionCleanup>;
	readonly subscribeEvents: (
		listener: (batch: GameEventBatchSchema.Type) => void | PromiseLike<void>,
	) => Effect.Effect<GameSessionTransitionSubscriptionCleanup>;
}

namespace openGameSessionTransitionSubscriptionFx {
	export interface Props {
		readonly committedTransitions: CommittedTransitionsFxService;
		readonly delivery: (subscription: CommittedTransitionSubscription) => Effect.Effect<void>;
		readonly sessionScope: Scope.Scope;
	}
}

/** Owns one listener subscription scope, delivery fiber and explicit cleanup pair. */
const openGameSessionTransitionSubscriptionFx = Effect.fn(
	"openGameSessionTransitionSubscriptionFx",
)(function* ({
	committedTransitions,
	delivery,
	sessionScope,
}: openGameSessionTransitionSubscriptionFx.Props) {
	const listenerScope = yield* Scope.fork(sessionScope, ExecutionStrategy.sequential);
	const subscription = yield* committedTransitions.subscribe.pipe(Scope.extend(listenerScope));
	yield* Effect.forkIn(delivery(subscription), listenerScope);

	return {
		shutdown: subscription.shutdown,
		release: Scope.close(listenerScope, Exit.void),
	} satisfies GameSessionTransitionSubscriptionCleanup;
});

/**
 * Opens listener-specific committed-transition subscriptions. Each registration
 * atomically captures its own current transition and receives only later commits.
 */
export const createGameSessionTransitionSubscriptionsFx = Effect.fn(
	"createGameSessionTransitionSubscriptionsFx",
)(function* () {
	const committedTransitions = yield* CommittedTransitionsFx;
	const sessionScope = yield* Effect.scope;

	const subscribe = Effect.fn("subscribeGameSessionRuntimeFx")(
		(listener: () => void | PromiseLike<void>) =>
			openGameSessionTransitionSubscriptionFx({
				committedTransitions,
				sessionScope,
				delivery: (subscription) =>
					subscription.changes.pipe(
						Stream.mapAccum(
							subscription.current.runtime,
							(previousRuntime, transition) =>
								[
									transition.runtime,
									transition.runtime !== previousRuntime,
								] as const,
						),
						Stream.filter((runtimeChanged) => runtimeChanged),
						Stream.runForEach(() =>
							invokeExternalCallbackFx({
								callback: listener,
								failureMessage:
									"Arkini runtime listener failed; its subscription remains active.",
								value: undefined,
							}),
						),
					),
			}),
	);

	const subscribeTransitions = Effect.fn("subscribeGameSessionTransitionsFx")(
		(listener: (transition: CommittedTransitionSchema.Type) => void | PromiseLike<void>) =>
			openGameSessionTransitionSubscriptionFx({
				committedTransitions,
				sessionScope,
				delivery: (subscription) =>
					Stream.make(subscription.current).pipe(
						Stream.concat(subscription.changes),
						Stream.runForEach((transition) =>
							invokeExternalCallbackFx({
								callback: listener,
								failureMessage:
									"Arkini committed-transition listener failed; its subscription remains active.",
								value: transition,
							}),
						),
					),
			}),
	);

	const subscribeEvents = Effect.fn("subscribeGameSessionEventsFx")(
		(listener: (batch: GameEventBatchSchema.Type) => void | PromiseLike<void>) =>
			openGameSessionTransitionSubscriptionFx({
				committedTransitions,
				sessionScope,
				delivery: (subscription) =>
					subscription.changes.pipe(
						Stream.filter((transition) => transition.events.length > 0),
						Stream.map(
							(transition): GameEventBatchSchema.Type => ({
								events: transition.events,
							}),
						),
						Stream.runForEach((batch) =>
							invokeExternalCallbackFx({
								callback: listener,
								failureMessage:
									"Arkini event listener failed; its subscription remains active.",
								value: batch,
							}),
						),
					),
			}),
	);

	return {
		subscribe,
		subscribeTransitions,
		subscribeEvents,
	} satisfies GameSessionTransitionSubscriptions;
});
