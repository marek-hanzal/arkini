import { Cause, Deferred, Effect, Exit, Scope, Stream } from "effect";

import type { GameEventBatchSchema } from "~/engine/event/schema/GameEventBatchSchema";
import {
	CommittedTransitionsFx,
	type CommittedTransitionsFxService,
} from "~/engine/runtime/context/CommittedTransitionsFx";
import type { CommittedTransitionSchema } from "~/engine/runtime/schema/CommittedTransitionSchema";

export interface GameSessionTransitionSubscriptionCleanup {
	readonly close: Effect.Effect<void>;
}

interface GameSessionTransitionSubscriptions {
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
		readonly delivery: (
			changes: Stream.Stream<CommittedTransitionSchema.Type>,
		) => Effect.Effect<void, unknown>;
		readonly sessionScope: Scope.Scope;
		readonly onFatalError: (cause: unknown) => void;
	}
}

const invokeListenerFx = <Value>(
	listener: (value: Value) => void | PromiseLike<void>,
	value: Value,
) =>
	Effect.sync(() => listener(value)).pipe(
		Effect.flatMap((result) =>
			result === undefined
				? Effect.void
				: Effect.tryPromise({
						try: () => Promise.resolve(result),
						catch: (cause) => cause,
					}),
		),
	);

const isSubscriptionClosure = (cause: Cause.Cause<unknown>) =>
	cause.reasons.length > 0 &&
	cause.reasons.every(
		(reason) =>
			Cause.isInterruptReason(reason) ||
			(Cause.isFailReason(reason) && Cause.isDone(reason.error)),
	);

/** Owns one listener subscription scope, delivery fiber and explicit cleanup pair. */
const openGameSessionTransitionSubscriptionFx = Effect.fn(
	"openGameSessionTransitionSubscriptionFx",
)(function* ({
	committedTransitions,
	delivery,
	sessionScope,
	onFatalError,
}: openGameSessionTransitionSubscriptionFx.Props) {
	const listenerScope = yield* Scope.fork(sessionScope, "sequential");
	const replaySeen = yield* Deferred.make<void>();
	const changes = committedTransitions.changes.pipe(
		Stream.tap(() => Deferred.succeed(replaySeen, undefined)),
	);
	yield* Effect.forkIn(
		delivery(changes).pipe(
			Effect.onError((cause) =>
				isSubscriptionClosure(cause) ? Effect.void : Effect.sync(() => onFatalError(cause)),
			),
		),
		listenerScope,
		{
			startImmediately: true,
		},
	);
	// Do not return registration until the replay has linearized this listener.
	yield* Deferred.await(replaySeen);

	return {
		close: Scope.close(listenerScope, Exit.void),
	} satisfies GameSessionTransitionSubscriptionCleanup;
});

/**
 * Opens listener-specific replaying committed-transition streams. Scope closure
 * interrupts the owned delivery fiber and releases its PubSub subscription.
 */
export const createGameSessionTransitionSubscriptionsFx = Effect.fn(
	"createGameSessionTransitionSubscriptionsFx",
)(function* (onFatalError: (cause: unknown) => void = () => undefined) {
	const committedTransitions = yield* CommittedTransitionsFx;
	const sessionScope = yield* Effect.scope;

	const subscribe = Effect.fn("subscribeGameSessionRuntimeFx")(
		(listener: () => void | PromiseLike<void>) =>
			openGameSessionTransitionSubscriptionFx({
				committedTransitions,
				sessionScope,
				onFatalError,
				delivery: (changes) =>
					changes.pipe(
						Stream.map((transition) => transition.runtime),
						Stream.changesWith(Object.is),
						Stream.drop(1),
						Stream.runForEach(() => invokeListenerFx(listener, undefined)),
					),
			}),
	);

	const subscribeTransitions = Effect.fn("subscribeGameSessionTransitionsFx")(
		(listener: (transition: CommittedTransitionSchema.Type) => void | PromiseLike<void>) =>
			openGameSessionTransitionSubscriptionFx({
				committedTransitions,
				sessionScope,
				onFatalError,
				delivery: (changes) =>
					changes.pipe(
						Stream.runForEach((transition) => invokeListenerFx(listener, transition)),
					),
			}),
	);

	const subscribeEvents = Effect.fn("subscribeGameSessionEventsFx")(
		(listener: (batch: GameEventBatchSchema.Type) => void | PromiseLike<void>) =>
			openGameSessionTransitionSubscriptionFx({
				committedTransitions,
				sessionScope,
				onFatalError,
				delivery: (changes) =>
					changes.pipe(
						// A replay may contain transient facts committed before this listener
						// linearized. Only later transitions are live event deliveries.
						Stream.drop(1),
						Stream.filter((transition) => transition.events.length > 0),
						Stream.map(
							(transition): GameEventBatchSchema.Type => ({
								events: transition.events,
							}),
						),
						Stream.runForEach((batch) => invokeListenerFx(listener, batch)),
					),
			}),
	);

	return {
		subscribe,
		subscribeTransitions,
		subscribeEvents,
	} satisfies GameSessionTransitionSubscriptions;
});
