import { Cause, Deferred, Effect, Exit, Scope, Stream } from "effect";

import type { GameEventBatchSchema } from "~/game-event/schema/GameEventBatchSchema";
import {
	CommittedTransitionsFx,
	type CommittedTransitionsFxService,
} from "~/game-runtime/context/CommittedTransitionsFx";
import type { CommittedTransitionSchema } from "~/game-runtime/schema/CommittedTransitionSchema";

export interface GameSessionTransitionSubscriptionCleanup {
	readonly close: Effect.Effect<void, never, never>;
}

interface GameSessionTransitionSubscriptions {
	readonly subscribeFx: (
		listenerFn: () => void | PromiseLike<void>,
	) => Effect.Effect<GameSessionTransitionSubscriptionCleanup, never, never>;
	readonly subscribeTransitionsFx: (
		listenerFn: (transition: CommittedTransitionSchema.Type) => void | PromiseLike<void>,
	) => Effect.Effect<GameSessionTransitionSubscriptionCleanup, never, never>;
	readonly subscribeEventsFx: (
		listenerFn: (batch: GameEventBatchSchema.Type) => void | PromiseLike<void>,
	) => Effect.Effect<GameSessionTransitionSubscriptionCleanup, never, never>;
}

namespace openGameSessionTransitionSubscriptionFx {
	export interface Props {
		readonly committedTransitions: CommittedTransitionsFxService;
		readonly deliveryFx: (
			changes: Stream.Stream<CommittedTransitionSchema.Type>,
		) => Effect.Effect<void, unknown, never>;
		readonly sessionScope: Scope.Scope;
		readonly onFatalErrorFn: (cause: unknown) => void;
	}
}

const invokeListenerFx = <Value>(
	listenerFn: (value: Value) => void | PromiseLike<void>,
	value: Value,
) =>
	Effect.sync(() => listenerFn(value)).pipe(
		Effect.flatMap((result) =>
			result === undefined
				? Effect.void
				: Effect.tryPromise({
						try: () => Promise.resolve(result),
						catch: (cause) => cause,
					}),
		),
	);

const isSubscriptionClosureFn = (cause: Cause.Cause<unknown>) =>
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
	deliveryFx,
	sessionScope,
	onFatalErrorFn,
}: openGameSessionTransitionSubscriptionFx.Props) {
	const listenerScope = yield* Scope.fork(sessionScope, "sequential");
	const replaySeen = yield* Deferred.make<void>();
	const changes = committedTransitions.changes.pipe(
		Stream.tap(() => Deferred.succeed(replaySeen, undefined)),
	);
	yield* Effect.forkIn(
		deliveryFx(changes).pipe(
			Effect.onError((cause) =>
				isSubscriptionClosureFn(cause)
					? Effect.void
					: Effect.sync(() => onFatalErrorFn(cause)),
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
)(function* (onFatalErrorFn: (cause: unknown) => void = () => undefined) {
	const committedTransitions = yield* CommittedTransitionsFx;
	const sessionScope = yield* Effect.scope;

	const subscribeFx = Effect.fn("subscribeGameSessionRuntimeFx")(
		(listenerFn: () => void | PromiseLike<void>) =>
			openGameSessionTransitionSubscriptionFx({
				committedTransitions,
				sessionScope,
				onFatalErrorFn,
				deliveryFx: (changes) =>
					changes.pipe(
						Stream.map((transition) => transition.runtime),
						Stream.changesWith(Object.is),
						Stream.drop(1),
						Stream.runForEach(() => invokeListenerFx(listenerFn, undefined)),
					),
			}),
	);

	const subscribeTransitionsFx = Effect.fn("subscribeGameSessionTransitionsFx")(
		(listenerFn: (transition: CommittedTransitionSchema.Type) => void | PromiseLike<void>) =>
			openGameSessionTransitionSubscriptionFx({
				committedTransitions,
				sessionScope,
				onFatalErrorFn,
				deliveryFx: (changes) =>
					changes.pipe(
						Stream.runForEach((transition) => invokeListenerFx(listenerFn, transition)),
					),
			}),
	);

	const subscribeEventsFx = Effect.fn("subscribeGameSessionEventsFx")(
		(listenerFn: (batch: GameEventBatchSchema.Type) => void | PromiseLike<void>) =>
			openGameSessionTransitionSubscriptionFx({
				committedTransitions,
				sessionScope,
				onFatalErrorFn,
				deliveryFx: (changes) =>
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
						Stream.runForEach((batch) => invokeListenerFx(listenerFn, batch)),
					),
			}),
	);

	return {
		subscribeFx,
		subscribeTransitionsFx,
		subscribeEventsFx,
	} satisfies GameSessionTransitionSubscriptions;
});
