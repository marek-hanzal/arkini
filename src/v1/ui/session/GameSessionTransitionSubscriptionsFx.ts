import { Effect, ExecutionStrategy, Exit, Scope, Stream } from "effect";

import { invokeExternalCallbackFx } from "~/v1/common/fx/invokeExternalCallbackFx";
import type { GameEventBatchSchema } from "~/v1/event/schema/GameEventBatchSchema";
import { CommittedTransitionsFx } from "~/v1/runtime/context/CommittedTransitionsFx";

export interface GameSessionTransitionSubscriptionCleanup {
	readonly shutdown: Effect.Effect<void>;
	readonly release: Effect.Effect<void>;
}

export interface GameSessionTransitionSubscriptions {
	readonly subscribe: (
		listener: () => void | PromiseLike<void>,
	) => Effect.Effect<GameSessionTransitionSubscriptionCleanup>;
	readonly subscribeEvents: (
		listener: (batch: GameEventBatchSchema.Type) => void | PromiseLike<void>,
	) => Effect.Effect<GameSessionTransitionSubscriptionCleanup>;
}

/**
 * Opens listener-specific committed-transition subscriptions. Each registration
 * atomically captures its own current transition and receives only later commits.
 */
export const GameSessionTransitionSubscriptionsFx = Effect.gen(function* () {
	const committedTransitions = yield* CommittedTransitionsFx;
	const sessionScope = yield* Effect.scope;

	const makeListenerScopeFx = Scope.fork(sessionScope, ExecutionStrategy.sequential);

	const subscribe = (listener: () => void | PromiseLike<void>) =>
		Effect.gen(function* () {
			const listenerScope = yield* makeListenerScopeFx;
			const subscription = yield* committedTransitions.subscribe.pipe(
				Scope.extend(listenerScope),
			);
			const delivery = subscription.changes.pipe(
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
			);

			yield* Effect.forkIn(delivery, listenerScope);

			return {
				shutdown: subscription.shutdown,
				release: Scope.close(listenerScope, Exit.void),
			};
		});

	const subscribeEvents = (
		listener: (batch: GameEventBatchSchema.Type) => void | PromiseLike<void>,
	) =>
		Effect.gen(function* () {
			const listenerScope = yield* makeListenerScopeFx;
			const subscription = yield* committedTransitions.subscribe.pipe(
				Scope.extend(listenerScope),
			);
			const delivery = subscription.changes.pipe(
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
			);

			yield* Effect.forkIn(delivery, listenerScope);

			return {
				shutdown: subscription.shutdown,
				release: Scope.close(listenerScope, Exit.void),
			};
		});

	return {
		subscribe,
		subscribeEvents,
	} satisfies GameSessionTransitionSubscriptions;
});
