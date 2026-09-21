import { Cause, Deferred, Effect, Exit, Fiber, Option } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { vi } from "vitest";

import { acquireGameEngineResourceFx } from "~/installed-game/fx/acquireGameEngineResourceFx";
import { CriticalGameLifecycleError } from "~/playable-game/error/CriticalGameLifecycleError";
import type { Game } from "~/installed-game/type/Game";
import { testSerapackConfig } from "~test/serapack-support/fx/createTestSerapack";
import { makeTestGameTransitionFieldsFx } from "~test/support/makeTestGameTransitionFieldsFx";
import { testGameRead } from "~test/support/testGameRead";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";

const createGame = ({
	packageId = "package:acquire",
	disposeWithoutSaveFx = Effect.void,
}: {
	readonly packageId?: string;
	readonly disposeWithoutSaveFx?: Game["disposeWithoutSaveFx"];
} = {}): Game => ({
	serapack: {
		packageId,
		contentHash: "content:acquire",
		title: testSerapackConfig.meta.title,
		version: "1.0",
		serakki: SerakkiAppVersion,
		provenance: {
			type: "community",
		} as const,
		source: "user",
	},
	config: testSerapackConfig,
	disposeFx: Effect.void,
	disposeWithoutSaveFx,
	flushSaveFx: Effect.void,
	manualSaveFx: Effect.void,
	listSavesFx: Effect.succeed([]),
	prepareRestoreFx: () => Effect.succeed(Effect.void),
	resources: [],
	getResourceUrlFn: () => "blob:test",
	...Effect.runSync(makeTestGameTransitionFieldsFx({} as ReturnType<Game["getSnapshotFn"]>)),
	readFn: testGameRead,
	runFn: (() => Promise.reject(new Error("Not used by this test."))) as Game["runFn"],
	saveKey: {
		packageId,
	},
	subscribeFn: () => () => undefined,
	subscribeEventsFn: () => () => undefined,
});

describe("acquireGameEngineResourceFx", () => {
	it.effect("composes its acquisition dependencies as Effect-native seams", () =>
		Effect.gen(function* () {
			const calls: string[] = [];
			const game = createGame();
			const resource = yield* acquireGameEngineResourceFx({
				beforeCreateFx: Effect.sync(() => {
					calls.push("before-create");
				}),
				createGameFx: (packageId) =>
					Effect.sync(() => {
						calls.push(`create:${packageId}`);
						return game;
					}),
				packageId: "package:acquire",
				rememberPackageFx: (packageId) =>
					Effect.sync(() => {
						calls.push(`remember:${packageId}`);
					}),
			});

			expect(calls).toEqual([
				"before-create",
				"create:package:acquire",
				"remember:package:acquire",
			]);
			expect(resource.game.serapack).toBe(game.serapack);
			yield* resource.game.disposeWithoutSaveFx;
		}),
	);

	it.effect("lets caller interruption cancel Effect-native creation before a Game exists", () =>
		Effect.gen(function* () {
			const createEntered = yield* Deferred.make<void>();
			const createInterrupted = yield* Deferred.make<void>();
			const fiber = yield* acquireGameEngineResourceFx({
				createGameFx: () =>
					Deferred.succeed(createEntered, undefined).pipe(
						Effect.andThen(Effect.never),
						Effect.onInterrupt(() =>
							Deferred.succeed(createInterrupted, undefined).pipe(Effect.asVoid),
						),
					),
				packageId: "package:acquire",
				rememberPackageFx: () => Effect.void,
			}).pipe(Effect.forkChild);
			yield* Deferred.await(createEntered);

			yield* Fiber.interrupt(fiber);
			const exit = yield* Fiber.await(fiber);
			yield* Deferred.await(createInterrupted);

			expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
		}),
	);

	it.effect("discards exactly once when caller interruption arrives after Game creation", () =>
		Effect.gen(function* () {
			const rememberEntered = yield* Deferred.make<void>();
			const discard = vi.fn();
			const game = createGame({
				disposeWithoutSaveFx: Effect.sync(discard),
			});
			const fiber = yield* acquireGameEngineResourceFx({
				createGameFx: () => Effect.succeed(game),
				packageId: "package:acquire",
				rememberPackageFx: () =>
					Deferred.succeed(rememberEntered, undefined).pipe(Effect.andThen(Effect.never)),
			}).pipe(Effect.forkChild);
			yield* Deferred.await(rememberEntered);

			yield* Fiber.interrupt(fiber);
			const exit = yield* Fiber.await(fiber);

			expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
			expect(discard).toHaveBeenCalledOnce();
		}),
	);

	it.effect("preserves a mixed provisional cleanup Cause over an ownership mismatch", () =>
		Effect.gen(function* () {
			const cleanupFailure = new Error("provisional cleanup failed");
			const cleanupDefect = new Error("provisional cleanup defect");
			const cleanupCause = Cause.combine(
				Cause.fail(cleanupFailure),
				Cause.die(cleanupDefect),
			);
			const game = createGame({
				packageId: "package:wrong",
				disposeWithoutSaveFx: Effect.failCause(cleanupCause),
			});

			const exit = yield* Effect.exit(
				acquireGameEngineResourceFx({
					createGameFx: () => Effect.succeed(game),
					packageId: "package:expected",
					rememberPackageFx: () => Effect.die("Must not remember an invalid package."),
				}),
			);

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isSuccess(exit)) throw new Error("Expected acquisition failure.");
			const failure = Cause.findErrorOption(exit.cause);
			expect(Option.isSome(failure)).toBe(true);
			if (Option.isNone(failure)) throw new Error("Expected typed critical failure.");
			expect(failure.value).toBeInstanceOf(CriticalGameLifecycleError);
			expect(failure.value).toMatchObject({
				operation: "engine-ownership",
			});
			const preservedCause = (failure.value as CriticalGameLifecycleError).cause;
			expect(Cause.isCause(preservedCause)).toBe(true);
			if (Cause.isCause(preservedCause)) {
				expect(Cause.hasDies(preservedCause)).toBe(true);
				expect(Cause.findErrorOption(preservedCause)).toEqual(Option.some(cleanupFailure));
			}
		}),
	);
});
