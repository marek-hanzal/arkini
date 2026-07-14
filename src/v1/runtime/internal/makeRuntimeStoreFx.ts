import { Effect, STM, Stream, TPubSub, TRef } from "effect";

import type { RuntimeStoreFxService } from "~/v1/runtime/internal/RuntimeStoreFx";
import type { CommittedTransitionSchema } from "~/v1/runtime/schema/CommittedTransitionSchema";

/**
 * Builds one committed-transition store with two explicit synchronization edges:
 * interruptible serialized mutation planning and synchronous atomic STM
 * commit/subscription registration.
 */
export const makeRuntimeStoreFx = (initial: CommittedTransitionSchema.Type) =>
	Effect.gen(function* () {
		const { changes, current } = yield* STM.commit(
			STM.gen(function* () {
				const current = yield* TRef.make(initial);
				const changes = yield* TPubSub.unbounded<CommittedTransitionSchema.Type>();

				return {
					changes,
					current,
				};
			}),
		);
		const mutationSemaphore = yield* Effect.makeSemaphore(1);

		const read = STM.commit(TRef.get(current));
		const modifyEffect: RuntimeStoreFxService["modifyEffect"] = (update) =>
			Effect.uninterruptibleMask((restore) =>
				// Waiting for ownership and all candidate planning remain cancellable.
				restore(mutationSemaphore.take(1)).pipe(
					Effect.flatMap((permits) =>
						restore(
							Effect.gen(function* () {
								const transition = yield* read;
								return {
									transition,
									updateResult: yield* update(transition),
								};
							}),
						).pipe(
							Effect.flatMap(
								({ transition, updateResult: [result, nextTransition] }) => {
									if (nextTransition === transition)
										return Effect.succeed(result);

									// Point of no return: one non-yielding STM transaction replaces
									// current, publishes the same transition and returns the command result.
									return STM.commit(
										STM.gen(function* () {
											yield* TRef.set(current, nextTransition);
											yield* TPubSub.publish(changes, nextTransition);
											return result;
										}),
									);
								},
							),
							Effect.ensuring(mutationSemaphore.release(permits)),
						),
					),
				),
			);
		const subscribe = Effect.gen(function* () {
			// Registration never touches the long-running mutation semaphore.
			// STM linearizes current capture and queue creation against commit, while
			// acquireRelease makes queue ownership cancellation-safe for the Scope.
			const subscription = yield* Effect.acquireRelease(
				STM.commit(
					STM.gen(function* () {
						const captured = yield* TRef.get(current);
						const queue = yield* TPubSub.subscribe(changes);

						return {
							captured,
							queue,
						};
					}),
				),
				({ queue }) => STM.commit(queue.shutdown),
			);
			const shutdown = STM.commit(subscription.queue.shutdown);

			return {
				current: subscription.captured,
				changes: Stream.fromTQueue(subscription.queue),
				shutdown,
			};
		});

		return {
			read,
			modifyEffect,
			subscribe,
		} satisfies RuntimeStoreFxService;
	});
