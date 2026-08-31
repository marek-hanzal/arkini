import { Cause, Deferred, Effect, Exit, Fiber, Layer, Option } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { beforeEach, vi } from "vitest";

import { createGameSessionFx } from "~/renderer/game/session/createGameSessionFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";

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

vi.mock(
	"~/renderer/game/session/createGameSessionTransitionSubscriptionsFx",
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import("~/renderer/game/session/createGameSessionTransitionSubscriptionsFx")
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
	},
);

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

	it.effect(
		"releases its partial scopes and managed runtime exactly once after a post-boot failure",
		() =>
			Effect.gen(function* () {
				const failure = new Error("post-boot initialization failed");
				bootstrap.controlledFx = Effect.fail(failure);
				bootstrap.probeRuntime = true;

				const exit = yield* Effect.exit(
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
			}),
	);

	it.effect(
		"interrupts post-boot initialization and stops the live Tick/save runtime before returning",
		() =>
			Effect.gen(function* () {
				const config = createJobTestConfig(2, "board", 60_000);
				let preparedState: StateSchema.Type | undefined;
				const preparation = yield* createGameSessionFx({
					config,
					tickIntervalMs: 60_000,
					save: {
						debounceMs: 60_000,
						write: (state) =>
							Effect.sync(() => {
								preparedState = state;
							}),
					},
				});
				const owner = yield* preparation.runFx(prepareJobLineFx());
				yield* preparation.runFx(
					startLineFx({
						ownerItemId: owner.id,
						lineId: "line:forge:run",
					}),
				);
				yield* preparation.flushSaveFx;
				yield* preparation.disposeWithoutSaveFx;
				if (preparedState === undefined)
					throw new Error("Expected one prepared saved state.");

				let writes = 0;
				const bootstrapEntered = yield* Deferred.make<void>();
				const secondWriteStarted = yield* Deferred.make<void>();
				bootstrap.events.length = 0;
				bootstrap.controlledFx = Deferred.succeed(bootstrapEntered, undefined).pipe(
					Effect.andThen(Effect.never),
				);
				bootstrap.probeRuntime = true;
				const creating = yield* createGameSessionFx({
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
				}).pipe(Effect.forkChild);

				yield* Effect.gen(function* () {
					yield* Deferred.await(bootstrapEntered);
					yield* Deferred.await(secondWriteStarted);
					yield* Fiber.interrupt(creating);
					const interrupted = yield* Fiber.await(creating);

					expect(Exit.isFailure(interrupted)).toBe(true);
					if (Exit.isFailure(interrupted)) {
						expect(Cause.hasInterruptsOnly(interrupted.cause)).toBe(true);
						expect(Option.isNone(Cause.findErrorOption(interrupted.cause))).toBe(true);
					}
					expectSingleOrderedRelease();
					expect(writes).toBeGreaterThanOrEqual(2);
				}).pipe(Effect.ensuring(Fiber.interrupt(creating)));
			}),
	);
});
