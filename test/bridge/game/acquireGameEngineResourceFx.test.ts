import { Cause, Deferred, Effect, Exit, Fiber, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

import { acquireGameEngineResourceFx } from "~/bridge/game/acquireGameEngineResourceFx";
import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";
import { makeTestGameTransitionFieldsFx } from "~test/support/game/makeTestGameTransitionFieldsFx";
import { testGameRead } from "~test/support/game/testGameRead";

const createGame = ({
	packageId = "package:acquire",
	disposeWithoutSaveFx = Effect.void,
}: {
	readonly packageId?: string;
	readonly disposeWithoutSaveFx?: Game["disposeWithoutSaveFx"];
} = {}): Game => ({
	arkpack: {
		packageId,
		contentHash: "content:acquire",
		gameId: testArkpackConfig.meta.id,
		title: testArkpackConfig.meta.title,
		game: testArkpackConfig.version,
		trust: {
			type: "external",
			reason: "unsigned",
		} as const,
		source: "imported",
	},
	config: testArkpackConfig,
	disposeFx: Effect.void,
	disposeWithoutSaveFx,
	flushSaveFx: Effect.void,
	getResourceUrl: () => "blob:test",
	...Effect.runSync(makeTestGameTransitionFieldsFx({} as ReturnType<Game["getSnapshot"]>)),
	read: testGameRead,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	saveKey: {
		packageId,
		contentHash: "0".repeat(64),
	},
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
});

describe("acquireGameEngineResourceFx", () => {
	it("composes its acquisition dependencies as Effect-native seams", async () => {
		const calls: string[] = [];
		const game = createGame();
		const resource = await Effect.runPromise(
			acquireGameEngineResourceFx({
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
			}),
		);

		expect(calls).toEqual([
			"before-create",
			"create:package:acquire",
			"remember:package:acquire",
		]);
		expect(resource.game.arkpack).toBe(game.arkpack);
		await Effect.runPromise(resource.game.disposeWithoutSaveFx);
	});

	it("lets caller interruption cancel Effect-native creation before a Game exists", async () => {
		const createEntered = Effect.runSync(Deferred.make<void>());
		const createInterrupted = Effect.runSync(Deferred.make<void>());
		const fiber = Effect.runFork(
			acquireGameEngineResourceFx({
				createGameFx: () =>
					Deferred.succeed(createEntered, undefined).pipe(
						Effect.andThen(Effect.never),
						Effect.onInterrupt(() =>
							Deferred.succeed(createInterrupted, undefined).pipe(Effect.asVoid),
						),
					),
				packageId: "package:acquire",
				rememberPackageFx: () => Effect.void,
			}),
		);
		await Effect.runPromise(Deferred.await(createEntered));

		await Effect.runPromise(Fiber.interrupt(fiber));
		const exit = await Effect.runPromise(Fiber.await(fiber));
		await Effect.runPromise(Deferred.await(createInterrupted));

		expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
	});

	it("discards exactly once when caller interruption arrives after Game creation", async () => {
		const rememberEntered = Effect.runSync(Deferred.make<void>());
		const discard = vi.fn();
		const game = createGame({
			disposeWithoutSaveFx: Effect.sync(discard),
		});
		const fiber = Effect.runFork(
			acquireGameEngineResourceFx({
				createGameFx: () => Effect.succeed(game),
				packageId: "package:acquire",
				rememberPackageFx: () =>
					Deferred.succeed(rememberEntered, undefined).pipe(Effect.andThen(Effect.never)),
			}),
		);
		await Effect.runPromise(Deferred.await(rememberEntered));

		await Effect.runPromise(Fiber.interrupt(fiber));
		const exit = await Effect.runPromise(Fiber.await(fiber));

		expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
		expect(discard).toHaveBeenCalledOnce();
	});

	it("preserves a mixed provisional cleanup Cause over an ownership mismatch", async () => {
		const cleanupFailure = new Error("provisional cleanup failed");
		const cleanupDefect = new Error("provisional cleanup defect");
		const cleanupCause = Cause.combine(Cause.fail(cleanupFailure), Cause.die(cleanupDefect));
		const game = createGame({
			packageId: "package:wrong",
			disposeWithoutSaveFx: Effect.failCause(cleanupCause),
		});

		const exit = await Effect.runPromiseExit(
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
	});
});
