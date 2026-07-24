import { Cause, Deferred, Effect, Exit, Fiber, Option, Scope, Stream } from "effect";
import { describe, expect, it } from "vitest";

import { GameCoreLayerFx } from "~/engine/game/layer/GameCoreLayerFx";
import { RuntimeStoreFx } from "~/engine/runtime/internal/RuntimeStoreFx";
import type { CommittedTransitionSchema } from "~/engine/runtime/schema/CommittedTransitionSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

const RuntimeStoreTestLayer = GameCoreLayerFx({
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
	it("leaves current and publication unchanged when planning is interrupted", async () => {
		const result = await Effect.runPromise(
			Effect.scoped(
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
							Deferred.succeed(planningEntered, undefined).pipe(
								Effect.andThen(Effect.never),
							),
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

					return {
						afterInterruption,
						before,
						marker,
						mutationExit,
						publication,
					};
				}),
			).pipe(Effect.provide(RuntimeStoreTestLayer)),
		);

		expect(result.afterInterruption).toBe(result.before);
		expect(Exit.isFailure(result.mutationExit)).toBe(true);
		if (Exit.isFailure(result.mutationExit)) {
			expect(Cause.hasInterruptsOnly(result.mutationExit.cause)).toBe(true);
		}
		expect(result.publication).toBe(result.marker);
	});

	it("returns, stores and publishes the exact successful transition once", async () => {
		const result = await Effect.runPromise(
			Effect.scoped(
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

					return {
						after: yield* store.read,
						before,
						commandResult,
						next,
						published,
					};
				}),
			).pipe(Effect.provide(RuntimeStoreTestLayer)),
		);

		expect(result.commandResult).toBe("committed");
		expect(result.after).toBe(result.next);
		expect(result.published).toHaveLength(2);
		expect(result.published[0]).toBe(result.before);
		expect(result.published[1]).toBe(result.next);
	});

	it("returns a no-op result without changing or publishing the identical transition", async () => {
		const result = await Effect.runPromise(
			Effect.scoped(
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

					return {
						afterNoOp,
						before,
						commandResult,
						marker,
						publication,
					};
				}),
			).pipe(Effect.provide(RuntimeStoreTestLayer)),
		);

		expect(result.commandResult).toBe("unchanged");
		expect(result.afterNoOp).toBe(result.before);
		expect(result.publication).toBe(result.marker);
	});

	it("releases mutation ownership after failed and defective planning", async () => {
		const result = await Effect.runPromise(
			Effect.scoped(
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

					return {
						afterDefectRead,
						afterFailure,
						afterFailureRead,
						before,
						defectivePlanning,
						failedPlanning,
						marker,
						publication,
					};
				}),
			).pipe(Effect.provide(RuntimeStoreTestLayer)),
		);

		expect(result.failedPlanning).toEqual(Exit.fail("planner-failed"));
		expect(result.afterFailureRead).toBe(result.before);
		expect(result.afterDefectRead).toBe(result.before);
		expect(Exit.isFailure(result.defectivePlanning)).toBe(true);
		if (Exit.isFailure(result.defectivePlanning)) {
			expect(Cause.hasDies(result.defectivePlanning.cause)).toBe(true);
		}
		expect(result.afterFailure).toBe("after-failure");
		expect(result.publication).toBe(result.marker);
	});

	it("serializes competing effectful planners against the latest committed transition", async () => {
		const result = await Effect.runPromise(
			Effect.scoped(
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

					return {
						after: yield* store.read,
						firstInput,
						secondBeforeRelease,
						secondInput,
					};
				}),
			).pipe(Effect.provide(RuntimeStoreTestLayer)),
		);

		expect(Option.isNone(result.secondBeforeRelease)).toBe(true);
		expect(result.secondInput.sequence).toBe(result.firstInput.sequence + 1);
		expect(result.secondInput.previousRuntime).toBe(result.firstInput.runtime);
		expect(result.after.sequence).toBe(result.secondInput.sequence + 1);
	});

	it("keeps a waiter interruptible without ever entering its planner", async () => {
		const result = await Effect.runPromise(
			Effect.scoped(
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

					return {
						plannerEntered,
						waitingExit,
					};
				}),
			).pipe(Effect.provide(RuntimeStoreTestLayer)),
		);

		expect(Option.isNone(result.plannerEntered)).toBe(true);
		expect(Exit.isFailure(result.waitingExit)).toBe(true);
		if (Exit.isFailure(result.waitingExit)) {
			expect(Cause.hasInterruptsOnly(result.waitingExit.cause)).toBe(true);
		}
	});

	it("gives a racing subscriber a gap-free replay or replay-plus-commit sequence", async () => {
		const sequences = await Effect.runPromise(
			Effect.scoped(
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

					return Array.from(yield* Fiber.join(subscriber)).map(
						(transition) => transition.sequence,
					);
				}),
			).pipe(Effect.provide(RuntimeStoreTestLayer)),
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
	});

	it("delivers ordered commits independently to multiple subscribers", async () => {
		const result = await Effect.runPromise(
			Effect.scoped(
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

					return {
						first: Array.from(yield* Fiber.join(first)),
						second: Array.from(yield* Fiber.join(second)),
					};
				}),
			).pipe(Effect.provide(RuntimeStoreTestLayer)),
		);

		expect(result.first.map((transition) => transition.sequence)).toEqual([
			0,
			1,
			2,
		]);
		expect(result.second.map((transition) => transition.sequence)).toEqual([
			0,
			1,
			2,
		]);
		expect(result.second[1]).toBe(result.first[1]);
		expect(result.second[2]).toBe(result.first[2]);
	});

	it("stops delivery when the listener scope closes", async () => {
		const result = await Effect.runPromise(
			Effect.scoped(
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

					return {
						after: yield* store.read,
						received,
					};
				}),
			).pipe(Effect.provide(RuntimeStoreTestLayer)),
		);

		expect(result.after.sequence).toBe(1);
		expect(result.received.map((transition) => transition.sequence)).toEqual([
			0,
		]);
	});
});
