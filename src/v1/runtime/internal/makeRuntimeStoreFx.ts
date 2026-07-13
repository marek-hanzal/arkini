import { Effect, PubSub, Queue, Ref, Stream } from "effect";

import type { CommittedTransitionSchema } from "~/v1/runtime/schema/CommittedTransitionSchema";
import type { RuntimeStoreFxService } from "~/v1/runtime/internal/RuntimeStoreFx";

/** Builds one serialized committed-transition store from Effect primitives. */
export const makeRuntimeStoreFx = (initial: CommittedTransitionSchema.Type) =>
	Effect.gen(function* () {
		const current = yield* Ref.make(initial);
		const changes = yield* PubSub.unbounded<CommittedTransitionSchema.Type>();
		const mutex = yield* Effect.makeSemaphore(1);

		const read = Ref.get(current);
		const modifyEffect: RuntimeStoreFxService["modifyEffect"] = (update) =>
			mutex.withPermits(1)(
				Effect.gen(function* () {
					const transition = yield* read;
					const [result, nextTransition] = yield* update(transition);

					if (nextTransition !== transition) {
						yield* Ref.set(current, nextTransition);
						yield* PubSub.publish(changes, nextTransition);
					}

					return result;
				}),
			);
		const subscribe = mutex.withPermits(1)(
			Effect.gen(function* () {
				const captured = yield* read;
				const queue = yield* PubSub.subscribe(changes);

				return {
					current: captured,
					changes: Stream.fromQueue(queue),
					shutdown: Queue.shutdown(queue),
				};
			}),
		);

		return {
			read,
			modifyEffect,
			subscribe,
		} satisfies RuntimeStoreFxService;
	});
