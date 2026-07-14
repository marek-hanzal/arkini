import { Cause, Deferred, Effect, Exit, Fiber, Option, Stream } from "effect";
import { describe, expect, it } from "vitest";

import { GameCoreLayerFx } from "~/v1/game/layer/GameCoreLayerFx";
import { CommittedTransitionsFx } from "~/v1/runtime/context/CommittedTransitionsFx";
import { RuntimeStoreFx } from "~/v1/runtime/internal/RuntimeStoreFx";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

const RuntimeStoreTestLayer = GameCoreLayerFx({
	config: createJobTestConfig(),
});

describe("makeRuntimeStoreFx", () => {
	it("leaves current and publication unchanged when planning is interrupted", async () => {
		const result = await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const store = yield* RuntimeStoreFx;
					const transitions = yield* CommittedTransitionsFx;
					const before = yield* store.read;
					const subscription = yield* transitions.subscribe;
					const publishedFiber = yield* subscription.changes.pipe(
						Stream.runHead,
						Effect.fork,
					);
					const planningEntered = yield* Deferred.make<void>();
					const mutationFiber = yield* store
						.modifyEffect(() =>
							Deferred.succeed(planningEntered, undefined).pipe(
								Effect.zipRight(Effect.never),
							),
						)
						.pipe(Effect.fork);

					yield* Deferred.await(planningEntered);
					const mutationExit = yield* Fiber.interrupt(mutationFiber);
					const after = yield* store.read;
					const publication = yield* Fiber.poll(publishedFiber);
					yield* Fiber.interrupt(publishedFiber);

					return {
						after,
						before,
						mutationExit,
						publication,
					};
				}),
			).pipe(Effect.provide(RuntimeStoreTestLayer)),
		);

		expect(result.after).toBe(result.before);
		expect(Exit.isFailure(result.mutationExit)).toBe(true);
		if (Exit.isFailure(result.mutationExit)) {
			expect(Cause.isInterruptedOnly(result.mutationExit.cause)).toBe(true);
		}
		expect(Option.isNone(result.publication)).toBe(true);
	});

	it("commits current, publication and result on one non-yielding STM edge", async () => {
		const result = await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const store = yield* RuntimeStoreFx;
					const transitions = yield* CommittedTransitionsFx;
					const before = yield* store.read;
					const next = {
						...before,
						runtime: {
							...before.runtime,
						},
					};
					const subscription = yield* transitions.subscribe;
					const publishedFiber = yield* subscription.changes.pipe(
						Stream.runHead,
						Effect.fork,
					);
					const mutationFiber = yield* store
						.modifyEffect(() =>
							Effect.succeed([
								"committed",
								next,
							] as const),
						)
						.pipe(Effect.fork);
					const publication = Option.getOrThrow(yield* Fiber.join(publishedFiber));
					const mutationExit = yield* Fiber.interrupt(mutationFiber);
					const after = yield* store.read;

					return {
						after,
						mutationExit,
						next,
						publication,
					};
				}),
			).pipe(Effect.provide(RuntimeStoreTestLayer)),
		);

		expect(result.after).toBe(result.next);
		expect(result.publication).toBe(result.next);
		expect(result.mutationExit).toEqual(Exit.succeed("committed"));
	});
});
