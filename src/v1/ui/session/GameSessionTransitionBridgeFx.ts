import { Effect, Stream } from "effect";

import { invokeExternalCallbackFx } from "~/v1/common/fx/invokeExternalCallbackFx";
import type { GameEventBatchSchema } from "~/v1/event/schema/GameEventBatchSchema";
import { CommittedTransitionsFx } from "~/v1/runtime/context/CommittedTransitionsFx";

export interface GameSessionTransitionBridge {
	readonly subscribe: (listener: () => void) => () => void;
	readonly subscribeEvents: (listener: (batch: GameEventBatchSchema.Type) => void) => () => void;
}

/**
 * Adapts committed transitions into framework-neutral invalidation and event
 * callbacks. Runtime state remains owned exclusively by RuntimeStoreFx.
 */
export const GameSessionTransitionBridgeFx = Effect.gen(function* () {
	const committedTransitions = yield* CommittedTransitionsFx;
	const subscription = yield* committedTransitions.subscribe;
	const runtimeListeners = new Set<() => void>();
	const eventListeners = new Set<(batch: GameEventBatchSchema.Type) => void>();

	const delivery = subscription.changes.pipe(
		Stream.mapAccum(
			subscription.current.runtime,
			(previousRuntime, transition) =>
				[
					transition.runtime,
					{
						runtimeChanged: transition.runtime !== previousRuntime,
						transition,
					},
				] as const,
		),
		Stream.runForEach(({ runtimeChanged, transition }) =>
			Effect.gen(function* () {
				if (runtimeChanged) {
					yield* Effect.forEach(
						[
							...runtimeListeners,
						],
						(listener) =>
							invokeExternalCallbackFx({
								callback: listener,
								failureMessage:
									"Arkini runtime listener failed; remaining session listeners continue.",
								value: undefined,
							}),
						{
							discard: true,
						},
					);
				}

				if (transition.events.length === 0) return;

				const batch = {
					events: transition.events,
				};
				yield* Effect.forEach(
					[
						...eventListeners,
					],
					(listener) =>
						invokeExternalCallbackFx({
							callback: listener,
							failureMessage:
								"Arkini event listener failed; remaining session listeners continue.",
							value: batch,
						}),
					{
						discard: true,
					},
				);
			}),
		),
	);

	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			runtimeListeners.clear();
			eventListeners.clear();
		}),
	);
	yield* Effect.forkScoped(delivery);

	return {
		subscribe: (listener: () => void) => {
			runtimeListeners.add(listener);
			return () => runtimeListeners.delete(listener);
		},
		subscribeEvents: (listener: (batch: GameEventBatchSchema.Type) => void) => {
			eventListeners.add(listener);
			return () => eventListeners.delete(listener);
		},
	} satisfies GameSessionTransitionBridge;
});
