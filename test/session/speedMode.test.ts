import { Effect, Fiber, Option, Stream, TestClock, TestContext } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { startLineFx } from "~/v1/job/write/startLineFx";
import { CommittedTransitionsFx } from "~/v1/runtime/context/CommittedTransitionsFx";
import { fromStateFx } from "~/v1/runtime/fx/fromStateFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { readSpeedModeFx } from "~/v1/session/read/readSpeedModeFx";
import { toggleSpeedModeFx } from "~/v1/session/write/toggleSpeedModeFx";
import { fromRuntimeFx } from "~/v1/state/fx/fromRuntimeFx";
import { TickFx } from "~/v1/tick/context/TickFx";
import { runTickRuntimeByFx } from "~/v1/tick/fx/runTickRuntimeByFx";
import { runTickRuntimeFx } from "~/v1/tick/fx/runTickRuntimeFx";
import { createTemporaryLifetimeTestConfig } from "~test/item/temporary/support/createTemporaryLifetimeTestConfig";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";

const jobProps = {
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
};

const withTestContext = <Result, Error, Requirements>(
	effect: Effect.Effect<Result, Error, Requirements>,
) => effect.pipe(Effect.provide(TestContext.TestContext));

describe("runtime session speed mode", () => {
	it("toggles canonical root state without requiring a cheat item", async () => {
		const result = await Effect.runPromise(
			withTestContext(
				Effect.scoped(
					Effect.gen(function* () {
						const transitions = yield* CommittedTransitionsFx;
						const subscription = yield* transitions.subscribe;
						const nextFiber = yield* subscription.changes.pipe(
							Stream.runHead,
							Effect.fork,
						);
						const initial = yield* readSpeedModeFx();
						const accelerated = yield* toggleSpeedModeFx();
						const transition = Option.getOrThrow(yield* Fiber.join(nextFiber));
						const normal = yield* toggleSpeedModeFx();

						return {
							accelerated,
							initial,
							normal,
							runtime: yield* readRuntimeFx(),
							transition,
						};
					}),
				).pipe(
					useGameFx({
						config: createJobTestConfig(),
					}),
				),
			),
		);

		expect(result.initial).toBe("normal");
		expect(result.accelerated).toBe("accelerated");
		expect(result.normal).toBe("normal");
		expect(result.runtime.session.speedMode).toBe("normal");
		expect(result.runtime.items).toEqual([]);
		expect(result.transition.events).toEqual([
			{
				type: "speed-mode:changed",
				speedMode: "accelerated",
			},
		]);
	});

	it("does not rewrite active jobs or temporary item state while toggling", async () => {
		const jobResult = await Effect.runPromise(
			withTestContext(
				Effect.gen(function* () {
					yield* prepareJobLineFx();
					yield* startLineFx(jobProps);
					const before = yield* readRuntimeFx();
					yield* toggleSpeedModeFx();
					const after = yield* readRuntimeFx();

					return {
						after: after.jobs[0],
						before: before.jobs[0],
					};
				}).pipe(
					useGameFx({
						config: createJobTestConfig(),
					}),
				),
			),
		);
		expect(jobResult.after).toEqual(jobResult.before);

		const temporaryResult = await Effect.runPromise(
			withTestContext(
				Effect.gen(function* () {
					const item = yield* spawnItemFx({
						id: "runtime:temporary:speed",
						itemId: "temporaryPlain",
						location: {
							scope: "board",
							space: 0,
							position: {
								x: 0,
								y: 0,
							},
						},
						quantity: 1,
					});
					yield* toggleSpeedModeFx();
					return (yield* readRuntimeFx()).items.find(
						(candidate) => candidate.id === item.id,
					);
				}).pipe(
					useGameFx({
						config: createTemporaryLifetimeTestConfig(),
					}),
				),
			),
		);
		expect(temporaryResult).toMatchObject({
			id: "runtime:temporary:speed",
			remainingDurationMs: 600,
		});
	});

	it("feeds equivalent wall time into the same fixed-step simulation", async () => {
		const run = async ({
			accelerated,
			wallElapsedMs,
		}: {
			accelerated: boolean;
			wallElapsedMs: number;
		}) => {
			return await Effect.runPromise(
				withTestContext(
					Effect.gen(function* () {
						yield* prepareJobLineFx();
						yield* startLineFx(jobProps);
						if (accelerated) yield* toggleSpeedModeFx();
						yield* TestClock.adjust(wallElapsedMs);
						yield* runTickRuntimeFx();
						return (yield* readRuntimeFx()).jobs[0]?.remainingMs;
					}).pipe(
						useGameFx({
							config: createJobTestConfig(),
						}),
					),
				),
			);
		};

		expect(
			await run({
				accelerated: false,
				wallElapsedMs: 600,
			}),
		).toBe(400);
		expect(
			await run({
				accelerated: true,
				wallElapsedMs: 20,
			}),
		).toBe(400);
	});

	it("does not retroactively accelerate pending normal time", async () => {
		const result = await Effect.runPromise(
			withTestContext(
				Effect.gen(function* () {
					yield* prepareJobLineFx();
					yield* startLineFx(jobProps);
					yield* TestClock.adjust(199);
					yield* runTickRuntimeFx();
					yield* toggleSpeedModeFx();
					yield* TestClock.adjust(1);
					yield* runTickRuntimeFx();

					return {
						runtime: yield* readRuntimeFx(),
						tick: yield* (yield* TickFx).read,
					};
				}).pipe(
					useGameFx({
						config: createJobTestConfig(),
					}),
				),
			),
		);

		expect(result.runtime.jobs[0]?.remainingMs).toBe(800);
		expect(result.tick.pendingElapsedMs).toBe(29);
	});

	it("keeps explicit simulation budgets independent from speed mode", async () => {
		const remainingMs = await Effect.runPromise(
			withTestContext(
				Effect.gen(function* () {
					yield* prepareJobLineFx();
					yield* startLineFx(jobProps);
					yield* toggleSpeedModeFx();
					yield* runTickRuntimeByFx({
						elapsedMs: 200,
					});
					return (yield* readRuntimeFx()).jobs[0]?.remainingMs;
				}).pipe(
					useGameFx({
						config: createJobTestConfig(),
					}),
				),
			),
		);

		expect(remainingMs).toBe(800);
	});

	it("omits speed mode from save state and recreates sessions in normal mode", async () => {
		const result = await Effect.runPromise(
			withTestContext(
				Effect.gen(function* () {
					yield* toggleSpeedModeFx();
					const accelerated = yield* readRuntimeFx();
					const state = yield* fromRuntimeFx({
						runtime: accelerated,
					});
					const restored = yield* fromStateFx({
						state,
					});

					return {
						accelerated,
						restored,
						state,
					};
				}).pipe(
					useGameFx({
						config: createJobTestConfig(),
					}),
				),
			),
		);

		expect(result.accelerated.session.speedMode).toBe("accelerated");
		expect("session" in result.state).toBe(false);
		expect(result.restored.session.speedMode).toBe("normal");
	});
});
