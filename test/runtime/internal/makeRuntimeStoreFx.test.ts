import { Cause, Deferred, Effect, Exit, Fiber, Option, Scope, Stream } from "effect";
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

	it("releases a subscription queue when its owning scope closes", async () => {
		const result = await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const store = yield* RuntimeStoreFx;
					const transitions = yield* CommittedTransitionsFx;
					const subscriptionScope = yield* Scope.make();
					const subscription = yield* transitions.subscribe.pipe(
						Scope.extend(subscriptionScope),
					);

					yield* Scope.close(subscriptionScope, Exit.void);
					yield* store.modifyEffect((transition) =>
						Effect.succeed([
							undefined,
							{
								...transition,
								runtime: {
									...transition.runtime,
								},
							},
						] as const),
					);

					return yield* subscription.changes.pipe(Stream.runHead);
				}),
			).pipe(Effect.provide(RuntimeStoreTestLayer)),
		);

		expect(Option.isNone(result)).toBe(true);
	});

	it("releases mutation ownership after interrupted and failed planning", async () => {
		const result = await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const store = yield* RuntimeStoreFx;
					const planningEntered = yield* Deferred.make<void>();
					const interruptedFiber = yield* store
						.modifyEffect(() =>
							Deferred.succeed(planningEntered, undefined).pipe(
								Effect.zipRight(Effect.never),
							),
						)
						.pipe(Effect.fork);

					yield* Deferred.await(planningEntered);
					yield* Fiber.interrupt(interruptedFiber);

					const afterInterrupt = yield* store.modifyEffect((transition) =>
						Effect.succeed([
							"after-interrupt",
							{
								...transition,
								runtime: {
									...transition.runtime,
								},
							},
						] as const),
					);
					const failedPlanning = yield* store
						.modifyEffect(() => Effect.fail("planner-failed"))
						.pipe(Effect.exit);
					const afterFailure = yield* store.modifyEffect((transition) =>
						Effect.succeed([
							"after-failure",
							{
								...transition,
								runtime: {
									...transition.runtime,
								},
							},
						] as const),
					);

					return {
						afterFailure,
						afterInterrupt,
						failedPlanning,
					};
				}),
			).pipe(Effect.provide(RuntimeStoreTestLayer)),
		);

		expect(result.afterInterrupt).toBe("after-interrupt");
		expect(result.failedPlanning).toEqual(Exit.fail("planner-failed"));
		expect(result.afterFailure).toBe("after-failure");
	});
});
