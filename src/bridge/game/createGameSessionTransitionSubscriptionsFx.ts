import { Deferred, Effect, Exit, Scope, Stream } from "effect";

import { invokeExternalCallbackFx } from "~/engine/common/fx/invokeExternalCallbackFx";
import type { GameEventBatchSchema } from "~/engine/event/schema/GameEventBatchSchema";
import {
	CommittedTransitionsFx,
	type CommittedTransitionsFxService,
} from "~/engine/runtime/context/CommittedTransitionsFx";
import type { CommittedTransitionSchema } from "~/engine/runtime/schema/CommittedTransitionSchema";

export interface GameSessionTransitionSubscriptionCleanup {
	readonly close: Effect.Effect<void>;
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
		readonly delivery: (
			changes: Stream.Stream<CommittedTransitionSchema.Type>,
		) => Effect.Effect<void>;
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
	const listenerScope = yield* Scope.fork(sessionScope, "sequential");
	const replaySeen = yield* Deferred.make<void>();
	const changes = committedTransitions.changes.pipe(
		Stream.tap(() => Deferred.succeed(replaySeen, undefined)),
	);
	yield* Effect.forkIn(delivery(changes), listenerScope, {
		startImmediately: true,
	});
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
)(function* () {
	const committedTransitions = yield* CommittedTransitionsFx;
	const sessionScope = yield* Effect.scope;

	const subscribe = Effect.fn("subscribeGameSessionRuntimeFx")(
		(listener: () => void | PromiseLike<void>) =>
			openGameSessionTransitionSubscriptionFx({
				committedTransitions,
				sessionScope,
				delivery: (changes) =>
					changes.pipe(
						Stream.map((transition) => transition.runtime),
						Stream.changesWith(Object.is),
						Stream.drop(1),
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
				delivery: (changes) =>
					changes.pipe(
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
