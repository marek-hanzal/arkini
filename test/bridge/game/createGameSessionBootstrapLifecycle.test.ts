import { Cause, Deferred, Effect, Exit, Fiber, Layer, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createGameSessionFx } from "~/bridge/game/createGameSessionFx";
import { startLineFx } from "~test/job/support/startLineTestFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";

const bootstrap = vi.hoisted(() => ({
	controlledFx: undefined as Effect.Effect<void, unknown> | undefined,
	events: [] as string[],
	probeRuntime: false,
}));

vi.mock("~/engine/game/layer/GameSessionLayerFx", async (importOriginal) => {
	const actual = await importOriginal<typeof import("~/engine/game/layer/GameSessionLayerFx")>();

	return {
		...actual,
		GameSessionLayerFx: (props: Parameters<typeof actual.GameSessionLayerFx>[0]) => {
			const sessionLayer = actual.GameSessionLayerFx(props);
			if (!bootstrap.probeRuntime) return sessionLayer;

			const probeLayer = Layer.effectDiscard(
				Effect.acquireRelease(
					Effect.sync(() => {
						bootstrap.events.push("managed-runtime-acquired");
					}),
					() =>
						Effect.sync(() => {
							bootstrap.events.push("managed-runtime-disposed");
						}),
				),
			);
			return Layer.merge(sessionLayer, probeLayer);
		},
	};
});

vi.mock("~/bridge/game/createGameSessionTransitionSubscriptionsFx", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("~/bridge/game/createGameSessionTransitionSubscriptionsFx")
		>();

	return {
		...actual,
		createGameSessionTransitionSubscriptionsFx: () => {
			const controlledFx = bootstrap.controlledFx;
			if (controlledFx === undefined) {
				return actual.createGameSessionTransitionSubscriptionsFx();
			}

			return Effect.gen(function* () {
				yield* Effect.addFinalizer(() =>
					Effect.sync(() => {
						bootstrap.events.push("session-scope-closed");
					}),
				);
				bootstrap.events.push("bootstrap-entered");
				return yield* controlledFx;
			});
		},
	};
});

const expectSingleOrderedRelease = () => {
	expect(bootstrap.events.filter((event) => event === "session-scope-closed")).toHaveLength(1);
	expect(bootstrap.events.filter((event) => event === "managed-runtime-disposed")).toHaveLength(
		1,
	);
	expect(bootstrap.events.indexOf("session-scope-closed")).toBeLessThan(
		bootstrap.events.indexOf("managed-runtime-disposed"),
	);
};

describe("createGameSessionFx bootstrap lifecycle", () => {
	beforeEach(() => {
		bootstrap.controlledFx = undefined;
		bootstrap.events.length = 0;
		bootstrap.probeRuntime = false;
	});

	it("releases its partial scopes and managed runtime exactly once after a post-boot failure", async () => {
		const failure = new Error("post-boot initialization failed");
		bootstrap.controlledFx = Effect.fail(failure);
		bootstrap.probeRuntime = true;

		const exit = await Effect.runPromiseExit(
			createGameSessionFx({
				config: createJobTestConfig(),
				tickIntervalMs: 60_000,
			}),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const found = Cause.findErrorOption(exit.cause);
			expect(Option.isSome(found)).toBe(true);
			if (Option.isSome(found)) expect(found.value).toBe(failure);
		}
		expect(bootstrap.events).toContain("managed-runtime-acquired");
		expect(bootstrap.events).toContain("bootstrap-entered");
		expectSingleOrderedRelease();
	});

	it("interrupts post-boot initialization and stops the live Tick/save runtime before returning", async () => {
		const config = createJobTestConfig(2, "board", 60_000);
		let preparedState: StateSchema.Type | undefined;
		const preparation = await Effect.runPromise(
			createGameSessionFx({
				config,
				tickIntervalMs: 60_000,
				save: {
					debounceMs: 60_000,
					write: (state) =>
						Effect.sync(() => {
							preparedState = state;
						}),
				},
			}),
		);
		const owner = await preparation.run(prepareJobLineFx());
		await preparation.run(
			startLineFx({
				ownerItemId: owner.id,
				lineId: "line:forge:run",
			}),
		);
		await Effect.runPromise(preparation.flushSaveFx);
		await Effect.runPromise(preparation.disposeWithoutSaveFx);
		if (preparedState === undefined) throw new Error("Expected one prepared saved state.");

		let writes = 0;
		const bootstrapEntered = Effect.runSync(Deferred.make<void>());
		const secondWriteStarted = Effect.runSync(Deferred.make<void>());
		bootstrap.events.length = 0;
		bootstrap.controlledFx = Deferred.succeed(bootstrapEntered, undefined).pipe(
			Effect.andThen(Effect.never),
		);
		bootstrap.probeRuntime = true;
		const creating = Effect.runFork(
			createGameSessionFx({
				config,
				state: preparedState,
				tickIntervalMs: 2,
				save: {
					debounceMs: 0,
					write: () =>
						Effect.gen(function* () {
							writes += 1;
							if (writes === 2) {
								yield* Deferred.succeed(secondWriteStarted, undefined);
							}
						}),
				},
			}),
		);

		try {
			await Effect.runPromise(Deferred.await(bootstrapEntered));
			await Effect.runPromise(Deferred.await(secondWriteStarted));
			await Effect.runPromise(Fiber.interrupt(creating));
			const interrupted = await Effect.runPromise(Fiber.await(creating));

			expect(Exit.isFailure(interrupted)).toBe(true);
			if (Exit.isFailure(interrupted)) {
				expect(Cause.hasInterruptsOnly(interrupted.cause)).toBe(true);
				expect(Option.isNone(Cause.findErrorOption(interrupted.cause))).toBe(true);
			}
			expectSingleOrderedRelease();
			expect(writes).toBeGreaterThanOrEqual(2);
		} finally {
			await Effect.runPromise(Fiber.interrupt(creating));
		}
	});
});
