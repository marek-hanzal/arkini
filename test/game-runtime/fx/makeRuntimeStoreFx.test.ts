import { Cause, Deferred, Effect, Exit, Fiber, Option, Scope, Stream } from "effect";
import { describe, expect, it } from "@effect/vitest";

import { GameRuntimeLayerFx } from "~/game-runtime/layer/GameRuntimeLayerFx";
import { RuntimeStoreFx } from "~/game-runtime/context/RuntimeStoreFx";
import type { CommittedTransitionSchema } from "~/game-runtime/schema/CommittedTransitionSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

const RuntimeStoreTestLayer = GameRuntimeLayerFx({
	config: createJobTestConfig(),
});

const advanceTransitionFx = Effect.fn("advanceTransitionFx")(function* (
	transition: CommittedTransitionSchema.Type,
) {
	return {
		sequence: transition.sequence + 1,
		previousRuntime: transition.runtime,
		runtime: {
			...transition.runtime,
		},
		events: [],
	} satisfies CommittedTransitionSchema.Type;
});

describe("makeRuntimeStoreFx", () => {
	it.effect("leaves current and publication unchanged when planning is interrupted", () =>
		Effect.gen(function* () {
			const store = yield* RuntimeStoreFx;
			const before = yield* store.read;
			const replaySeen = yield* Deferred.make<void>();
			const publishedFiber = yield* store.changes.pipe(
				Stream.tap(() => Deferred.succeed(replaySeen, undefined)),
				Stream.drop(1),
				Stream.runHead,
				Effect.forkChild,
			);
			yield* Deferred.await(replaySeen);

			const planningEntered = yield* Deferred.make<void>();
			const mutationFiber = yield* store
				.modifyEffect(() =>
					Deferred.succeed(planningEntered, undefined).pipe(Effect.andThen(Effect.never)),
				)
				.pipe(Effect.forkChild);

			yield* Deferred.await(planningEntered);
			yield* Fiber.interrupt(mutationFiber);
			const mutationExit = yield* Fiber.await(mutationFiber);
			const afterInterruption = yield* store.read;
			const marker = yield* advanceTransitionFx(afterInterruption);
			yield* store.modifyEffect(() =>
				Effect.succeed([
					undefined,
					marker,
				] as const),
			);
			const publication = Option.getOrThrow(yield* Fiber.join(publishedFiber));

			expect(afterInterruption).toBe(before);
			expect(Exit.isFailure(mutationExit)).toBe(true);
			if (Exit.isFailure(mutationExit)) {
				expect(Cause.hasInterruptsOnly(mutationExit.cause)).toBe(true);
			}
			expect(publication).toBe(marker);
		}).pipe(Effect.provide(RuntimeStoreTestLayer)),
	);

	it.effect("returns, stores and publishes the exact successful transition once", () =>
		Effect.gen(function* () {
			const store = yield* RuntimeStoreFx;
			const before = yield* store.read;
			const next = yield* advanceTransitionFx(before);
			const replaySeen = yield* Deferred.make<void>();
			const publishedFiber = yield* store.changes.pipe(
				Stream.tap(() => Deferred.succeed(replaySeen, undefined)),
				Stream.take(2),
				Stream.runCollect,
				Effect.forkChild,
			);
			yield* Deferred.await(replaySeen);

			const commandResult = yield* store.modifyEffect(() =>
				Effect.succeed([
					"committed",
					next,
				] as const),
			);
			const published = Array.from(yield* Fiber.join(publishedFiber));

			const after = yield* store.read;

			expect(commandResult).toBe("committed");
			expect(after).toBe(next);
			expect(published).toHaveLength(2);
			expect(published[0]).toBe(before);
			expect(published[1]).toBe(next);
		}).pipe(Effect.provide(RuntimeStoreTestLayer)),
	);

	it.effect(
		"returns a no-op result without changing or publishing the identical transition",
		() =>
			Effect.gen(function* () {
				const store = yield* RuntimeStoreFx;
				const before = yield* store.read;
				const replaySeen = yield* Deferred.make<void>();
				const publishedFiber = yield* store.changes.pipe(
					Stream.tap(() => Deferred.succeed(replaySeen, undefined)),
					Stream.drop(1),
					Stream.runHead,
					Effect.forkChild,
				);
				yield* Deferred.await(replaySeen);

				const commandResult = yield* store.modifyEffect((transition) =>
					Effect.succeed([
						"unchanged",
						transition,
					] as const),
				);
				const afterNoOp = yield* store.read;
				const marker = yield* advanceTransitionFx(afterNoOp);
				yield* store.modifyEffect(() =>
					Effect.succeed([
						undefined,
						marker,
					] as const),
				);
				const publication = Option.getOrThrow(yield* Fiber.join(publishedFiber));

				expect(commandResult).toBe("unchanged");
				expect(afterNoOp).toBe(before);
				expect(publication).toBe(marker);
			}).pipe(Effect.provide(RuntimeStoreTestLayer)),
	);

	it.effect("releases mutation ownership after failed and defective planning", () =>
		Effect.gen(function* () {
			const store = yield* RuntimeStoreFx;
			const before = yield* store.read;
			const replaySeen = yield* Deferred.make<void>();
			const publishedFiber = yield* store.changes.pipe(
				Stream.tap(() => Deferred.succeed(replaySeen, undefined)),
				Stream.drop(1),
				Stream.runHead,
				Effect.forkChild,
			);
			yield* Deferred.await(replaySeen);

			const failedPlanning = yield* store
				.modifyEffect(() => Effect.fail("planner-failed"))
				.pipe(Effect.exit);
			const afterFailureRead = yield* store.read;
			const defectivePlanning = yield* store
				.modifyEffect(() => Effect.die("planner-defect"))
				.pipe(Effect.exit);
			const afterDefectRead = yield* store.read;
			const marker = yield* advanceTransitionFx(afterDefectRead);
			const afterFailure = yield* store.modifyEffect(() =>
				Effect.succeed([
					"after-failure",
					marker,
				] as const),
			);
			const publication = Option.getOrThrow(yield* Fiber.join(publishedFiber));

			expect(failedPlanning).toEqual(Exit.fail("planner-failed"));
			expect(afterFailureRead).toBe(before);
			expect(afterDefectRead).toBe(before);
			expect(Exit.isFailure(defectivePlanning)).toBe(true);
			if (Exit.isFailure(defectivePlanning)) {
				expect(Cause.hasDies(defectivePlanning.cause)).toBe(true);
			}
			expect(afterFailure).toBe("after-failure");
			expect(publication).toBe(marker);
		}).pipe(Effect.provide(RuntimeStoreTestLayer)),
	);

	it.effect(
		"serializes competing effectful planners against the latest committed transition",
		() =>
			Effect.gen(function* () {
				const store = yield* RuntimeStoreFx;
				const firstEntered = yield* Deferred.make<void>();
				const releaseFirst = yield* Deferred.make<void>();
				const secondEntered = yield* Deferred.make<void>();

				const firstFiber = yield* store
					.modifyEffect((transition) =>
						Deferred.succeed(firstEntered, undefined).pipe(
							Effect.andThen(Deferred.await(releaseFirst)),
							Effect.andThen(
								advanceTransitionFx(transition).pipe(
									Effect.map(
										(nextTransition) =>
											[
												transition,
												nextTransition,
											] as const,
									),
								),
							),
						),
					)
					.pipe(Effect.forkChild);
				yield* Deferred.await(firstEntered);

				const secondFiber = yield* store
					.modifyEffect((transition) =>
						Deferred.succeed(secondEntered, undefined).pipe(
							Effect.andThen(
								advanceTransitionFx(transition).pipe(
									Effect.map(
										(nextTransition) =>
											[
												transition,
												nextTransition,
											] as const,
									),
								),
							),
						),
					)
					.pipe(Effect.forkChild);
				const secondBeforeRelease = yield* Deferred.poll(secondEntered);

				yield* Deferred.succeed(releaseFirst, undefined);
				const firstInput = yield* Fiber.join(firstFiber);
				const secondInput = yield* Fiber.join(secondFiber);

				const after = yield* store.read;

				expect(Option.isNone(secondBeforeRelease)).toBe(true);
				expect(secondInput.sequence).toBe(firstInput.sequence + 1);
				expect(secondInput.previousRuntime).toBe(firstInput.runtime);
				expect(after.sequence).toBe(secondInput.sequence + 1);
			}).pipe(Effect.provide(RuntimeStoreTestLayer)),
	);

	it.effect("keeps a waiter interruptible without ever entering its planner", () =>
		Effect.gen(function* () {
			const store = yield* RuntimeStoreFx;
			const firstEntered = yield* Deferred.make<void>();
			const releaseFirst = yield* Deferred.make<void>();
			const secondEntered = yield* Deferred.make<void>();

			const firstFiber = yield* store
				.modifyEffect((transition) =>
					Deferred.succeed(firstEntered, undefined).pipe(
						Effect.andThen(Deferred.await(releaseFirst)),
						Effect.andThen(
							advanceTransitionFx(transition).pipe(
								Effect.map(
									(nextTransition) =>
										[
											undefined,
											nextTransition,
										] as const,
								),
							),
						),
					),
				)
				.pipe(Effect.forkChild);
			yield* Deferred.await(firstEntered);

			const waitingFiber = yield* store
				.modifyEffect((transition) =>
					Deferred.succeed(secondEntered, undefined).pipe(
						Effect.andThen(
							advanceTransitionFx(transition).pipe(
								Effect.map(
									(nextTransition) =>
										[
											undefined,
											nextTransition,
										] as const,
								),
							),
						),
					),
				)
				.pipe(Effect.forkChild);
			yield* Fiber.interrupt(waitingFiber);
			const waitingExit = yield* Fiber.await(waitingFiber);
			const plannerEntered = yield* Deferred.poll(secondEntered);
			yield* Deferred.succeed(releaseFirst, undefined);
			yield* Fiber.join(firstFiber);

			expect(Option.isNone(plannerEntered)).toBe(true);
			expect(Exit.isFailure(waitingExit)).toBe(true);
			if (Exit.isFailure(waitingExit)) {
				expect(Cause.hasInterruptsOnly(waitingExit.cause)).toBe(true);
			}
		}).pipe(Effect.provide(RuntimeStoreTestLayer)),
	);

	it.effect("gives a racing subscriber a gap-free replay or replay-plus-commit sequence", () =>
		Effect.gen(function* () {
			const store = yield* RuntimeStoreFx;
			const start = yield* Deferred.make<void>();
			const firstSeen = yield* Deferred.make<void>();

			const subscriber = yield* Stream.fromEffect(Deferred.await(start)).pipe(
				Stream.flatMap(() => store.changes),
				Stream.tap(() => Deferred.succeed(firstSeen, undefined)),
				Stream.takeUntil((transition) => transition.sequence === 2),
				Stream.runCollect,
				Effect.forkChild,
			);
			const commit = yield* Deferred.await(start).pipe(
				Effect.andThen(
					store.modifyEffect((transition) =>
						advanceTransitionFx(transition).pipe(
							Effect.map(
								(nextTransition) =>
									[
										undefined,
										nextTransition,
									] as const,
							),
						),
					),
				),
				Effect.forkChild,
			);

			yield* Deferred.succeed(start, undefined);
			yield* Fiber.join(commit);
			yield* Deferred.await(firstSeen);
			yield* store.modifyEffect((transition) =>
				advanceTransitionFx(transition).pipe(
					Effect.map(
						(nextTransition) =>
							[
								undefined,
								nextTransition,
							] as const,
					),
				),
			);

			const sequences = Array.from(yield* Fiber.join(subscriber)).map(
				(transition) => transition.sequence,
			);

			expect([
				[
					0,
					1,
					2,
				],
				[
					1,
					2,
				],
			]).toContainEqual(sequences);
		}).pipe(Effect.provide(RuntimeStoreTestLayer)),
	);

	it.effect("delivers ordered commits independently to multiple subscribers", () =>
		Effect.gen(function* () {
			const store = yield* RuntimeStoreFx;
			const firstReady = yield* Deferred.make<void>();
			const secondReady = yield* Deferred.make<void>();
			const collectTransitionsFx = Effect.fn("collectTransitionsFx")(
				(ready: Deferred.Deferred<void>) =>
					store.changes.pipe(
						Stream.tap(() => Deferred.succeed(ready, undefined)),
						Stream.take(3),
						Stream.runCollect,
						Effect.forkChild,
					),
			);
			const first = yield* collectTransitionsFx(firstReady);
			const second = yield* collectTransitionsFx(secondReady);
			yield* Deferred.await(firstReady);
			yield* Deferred.await(secondReady);

			yield* store.modifyEffect((transition) =>
				advanceTransitionFx(transition).pipe(
					Effect.map(
						(nextTransition) =>
							[
								undefined,
								nextTransition,
							] as const,
					),
				),
			);
			yield* store.modifyEffect((transition) =>
				advanceTransitionFx(transition).pipe(
					Effect.map(
						(nextTransition) =>
							[
								undefined,
								nextTransition,
							] as const,
					),
				),
			);

			const firstTransitions = Array.from(yield* Fiber.join(first));
			const secondTransitions = Array.from(yield* Fiber.join(second));

			expect(firstTransitions.map((transition) => transition.sequence)).toEqual([
				0,
				1,
				2,
			]);
			expect(secondTransitions.map((transition) => transition.sequence)).toEqual([
				0,
				1,
				2,
			]);
			expect(secondTransitions[1]).toBe(firstTransitions[1]);
			expect(secondTransitions[2]).toBe(firstTransitions[2]);
		}).pipe(Effect.provide(RuntimeStoreTestLayer)),
	);

	it.effect("stops delivery when the listener scope closes", () =>
		Effect.gen(function* () {
			const store = yield* RuntimeStoreFx;
			const listenerScope = yield* Scope.make();
			const replaySeen = yield* Deferred.make<void>();
			const received: CommittedTransitionSchema.Type[] = [];
			yield* store.changes.pipe(
				Stream.runForEach((transition) =>
					Effect.sync(() => {
						received.push(transition);
					}).pipe(Effect.andThen(Deferred.succeed(replaySeen, undefined))),
				),
				Effect.forkIn(listenerScope),
			);
			yield* Deferred.await(replaySeen);

			yield* Scope.close(listenerScope, Exit.void);
			yield* store.modifyEffect((transition) =>
				advanceTransitionFx(transition).pipe(
					Effect.map(
						(nextTransition) =>
							[
								undefined,
								nextTransition,
							] as const,
					),
				),
			);

			const after = yield* store.read;

			expect(after.sequence).toBe(1);
			expect(received.map((transition) => transition.sequence)).toEqual([
				0,
			]);
		}).pipe(Effect.provide(RuntimeStoreTestLayer)),
	);
});
