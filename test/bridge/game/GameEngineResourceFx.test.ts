import { Cause, Deferred, Effect, Exit, Fiber, ManagedRuntime, Option, Scope } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import { GameSessionFatalError } from "~/bridge/game/GameSessionFatalError";
import { GameEngineResourceLayer } from "~/bridge/game/GameEngineResourceLayer";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { GameEngineResourceFx, type GameEngineLease } from "~/bridge/game/GameEngineResourceFx";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";
import { makeTestGameTransitionFieldsFx } from "~test/support/game/makeTestGameTransitionFieldsFx";
import { testGameRead } from "~test/support/game/testGameRead";

const runtimes: Array<ManagedRuntime.ManagedRuntime<GameEngineResourceFx, never>> = [];

const makeResource = ({
	disposeFx = Effect.void,
	disposeWithoutSaveFx = Effect.void,
	packageId,
}: {
	readonly disposeFx?: Game["disposeFx"];
	readonly disposeWithoutSaveFx?: Game["disposeWithoutSaveFx"];
	readonly packageId: string;
}) =>
	Effect.runSync(
		createGameEngineResourceFx({
			arkpack: {
				packageId,
				hash: `content:${packageId}`,
				gameId: testArkpackConfig.meta.id,
				title: testArkpackConfig.meta.title,
				game: testArkpackConfig.version,
				trust: {
					type: "external",
					reason: "unsigned",
				},
				source: "imported",
			},
			config: testArkpackConfig,
			disposeFx,
			disposeWithoutSaveFx,
			flushSaveFx: Effect.void,
			getResourceUrl: () => "blob:test",
			...Effect.runSync(
				makeTestGameTransitionFieldsFx({} as ReturnType<Game["getSnapshot"]>),
			),
			read: testGameRead,
			run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
			saveKey: {
				packageId,
				contentHash: "0".repeat(64),
			},
			subscribe: () => () => undefined,
			subscribeEvents: () => () => undefined,
		}),
	);

const createHarness = (
	createResourceFx: (packageId: string) => Effect.Effect<GameEngineResource, unknown>,
	clearSaveFx: Parameters<typeof GameEngineResourceLayer>[0]["clearSaveFx"] = () => Effect.void,
) => {
	const runtime = ManagedRuntime.make(
		GameEngineResourceLayer({
			clearSaveFx,
			createResourceFx,
		}),
	);
	runtimes.push(runtime);

	const acquireLeaseEffect = (packageId: string, scope: Scope.Closeable) =>
		GameEngineResourceFx.pipe(
			Effect.flatMap((service) =>
				service.acquireLeaseFx({
					packageId,
				}),
			),
			Effect.provideService(Scope.Scope, scope),
		);

	const startLease = (packageId: string) => {
		const scope = Effect.runSync(Scope.make());
		return {
			close: () => Effect.runPromise(Scope.close(scope, Exit.void)),
			promise: runtime.runPromise(acquireLeaseEffect(packageId, scope)),
		};
	};

	const recoverFailedSaveEffect = (packageId: string) =>
		GameEngineResourceFx.pipe(
			Effect.flatMap((service) =>
				service.recoverFailedSaveFx({
					packageId,
				}),
			),
		);
	const claimForCloseEffect = GameEngineResourceFx.pipe(
		Effect.flatMap((service) => service.claimForCloseFx),
	);

	return {
		claimForClose: () => runtime.runPromise(claimForCloseEffect),
		close: (resource: GameEngineResource) =>
			runtime.runPromise(
				GameEngineResourceFx.pipe(Effect.flatMap((service) => service.closeFx(resource))),
			),
		adopt: (lease: GameEngineLease) =>
			runtime.runPromise(
				GameEngineResourceFx.pipe(Effect.flatMap((service) => service.adoptLeaseFx(lease))),
			),
		current: () =>
			runtime.runPromise(
				GameEngineResourceFx.pipe(Effect.flatMap((service) => service.currentFx)),
			),
		discardFailed: (packageId: string) =>
			runtime.runPromise(
				GameEngineResourceFx.pipe(
					Effect.flatMap((service) => service.discardFailedFx(packageId)),
				),
			),
		recoverFailedSave: (packageId: string) =>
			runtime.runPromise(recoverFailedSaveEffect(packageId)),
		release: (resource: GameEngineResource) =>
			runtime.runPromise(
				GameEngineResourceFx.pipe(
					Effect.flatMap((service) =>
						service.releaseFx({
							resource,
						}),
					),
				),
			),
		releaseAlreadyFinalized: (resource: GameEngineResource) =>
			runtime.runPromise(
				GameEngineResourceFx.pipe(
					Effect.flatMap((service) =>
						service.releaseFx({
							allowAlreadyFinalized: true,
							resource,
						}),
					),
				),
			),
		reset: (resource: GameEngineResource) =>
			runtime.runPromise(
				GameEngineResourceFx.pipe(
					Effect.flatMap((service) =>
						service.resetFx({
							resource,
						}),
					),
				),
			),
		runtime,
		startRecovery: (packageId: string) => {
			const fiber = runtime.runFork(recoverFailedSaveEffect(packageId));
			return {
				interrupt: () => Effect.runPromise(Fiber.interrupt(fiber)),
				promise: Effect.runPromise(Fiber.join(fiber)),
			};
		},
		startCloseClaim: () => {
			const fiber = runtime.runFork(claimForCloseEffect);
			return {
				exit: Effect.runPromise(Fiber.await(fiber)),
				interrupt: () => Effect.runPromise(Fiber.interrupt(fiber)),
			};
		},
		startLease,
		startLeaseExit: (packageId: string) => {
			const scope = Effect.runSync(Scope.make());
			return {
				close: () => Effect.runPromise(Scope.close(scope, Exit.void)),
				promise: runtime.runPromiseExit(acquireLeaseEffect(packageId, scope)),
			};
		},
	};
};

afterEach(async () => {
	for (const runtime of runtimes.splice(0)) {
		await runtime.dispose();
	}
});

describe("GameEngineResourceFx", () => {
	it("keeps the first critical resource failure as its permanent publication guard", () => {
		const resource = makeResource({
			packageId: "package:guard",
		});
		const firstCause = new Error("final save failed");
		const first = resource.markCriticalFailure("game-leave", firstCause);
		const second = resource.markCriticalFailure("game-reset", new Error("later failure"));

		expect(second).toBe(first);
		expect(first.cause).toBe(firstCause);
		expect(() => resource.assertUsable()).toThrow(first);
	});

	it("marks an unexpected live read failure critical with the same fail-stop error", () => {
		const resource = makeResource({
			packageId: "package:read",
		});
		const failure = new Error("line projection invariant failed");

		expect(() => resource.game.readOrThrow(Effect.fail(failure))).toThrow(
			CriticalGameLifecycleError,
		);
		let critical: unknown;
		try {
			resource.assertUsable();
		} catch (cause) {
			critical = cause;
		}
		expect(critical).toBeInstanceOf(CriticalGameLifecycleError);
		const criticalError = critical as CriticalGameLifecycleError;
		expect(criticalError.operation).toBe("game-read");
		expect(criticalError.cause).toBeInstanceOf(GameSessionFatalError);
		const sessionFatal = criticalError.cause as GameSessionFatalError;
		expect(sessionFatal.source).toBe("runtime");
		expect(sessionFatal.cause).toBe(failure);
	});

	it("preserves a mixed live read Cause inside the game-read fail-stop error", () => {
		const resource = makeResource({
			packageId: "package:mixed-read",
		});
		const readFailure = new Error("read failure");
		const readDefect = new Error("read defect");
		const readCause = Cause.combine(Cause.fail(readFailure), Cause.die(readDefect));

		expect(() => resource.game.readOrThrow(Effect.failCause(readCause))).toThrow(
			CriticalGameLifecycleError,
		);
		let critical: unknown;
		try {
			resource.assertUsable();
		} catch (cause) {
			critical = cause;
		}
		expect(critical).toBeInstanceOf(CriticalGameLifecycleError);
		expect((critical as CriticalGameLifecycleError).operation).toBe("game-read");
		const sessionFatal = (critical as CriticalGameLifecycleError).cause;
		expect(sessionFatal).toBeInstanceOf(GameSessionFatalError);
		expect((sessionFatal as GameSessionFatalError).source).toBe("runtime");
		const preservedCause = (sessionFatal as GameSessionFatalError).cause;
		expect(preservedCause).toBe(readCause);
		expect(Cause.isCause(preservedCause)).toBe(true);
		if (Cause.isCause(preservedCause)) {
			expect(Cause.hasDies(preservedCause)).toBe(true);
			expect(Cause.findErrorOption(preservedCause)).toEqual(Option.some(readFailure));
		}
	});

	it("joins same-package acquisition and adopts only an exact scoped lease", async () => {
		const resource = makeResource({
			packageId: "package:first",
		});
		const creation = Effect.runSync(Deferred.make<GameEngineResource>());
		const createResourceFx = vi.fn(() => Deferred.await(creation));
		const harness = createHarness(createResourceFx);
		const first = harness.startLease("package:first");
		const second = harness.startLease("package:first");

		await vi.waitFor(() => expect(createResourceFx).toHaveBeenCalledOnce());
		Effect.runSync(Deferred.succeed(creation, resource));
		const firstLease = await first.promise;
		const secondLease = await second.promise;
		expect(firstLease.resource).toBe(resource);
		expect(secondLease.resource).toBe(resource);
		expect(await harness.current()).toBeNull();

		await expect(
			harness.adopt({
				resource,
			} as GameEngineLease),
		).rejects.toThrow("Unknown Game Engine lease");
		await expect(harness.adopt(firstLease)).resolves.toBe(resource);
		await expect(harness.adopt(secondLease)).resolves.toBe(resource);
		expect(await harness.current()).toBe(resource);
		await expect(harness.discardFailed("package:first")).rejects.toThrow(
			"exact failed bootstrap resource",
		);
		expect(await harness.current()).toBe(resource);

		await first.close();
		await second.close();
		expect(await harness.current()).toBe(resource);
	});

	it("interrupts creation only after its final scoped consumer leaves", async () => {
		const interrupted = vi.fn();
		const createResourceFx = vi.fn(() =>
			Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(interrupted))),
		);
		const harness = createHarness(createResourceFx);
		const first = harness.startLease("package:first");
		const second = harness.startLease("package:first");
		void first.promise.catch(() => undefined);
		void second.promise.catch(() => undefined);
		await vi.waitFor(() => expect(createResourceFx).toHaveBeenCalledOnce());

		await first.close();
		expect(interrupted).not.toHaveBeenCalled();
		await second.close();
		await vi.waitFor(() => expect(interrupted).toHaveBeenCalledOnce());
		expect(await harness.current()).toBeNull();
	});

	it("discards an uninterruptible late-created resource after its scope leaves", async () => {
		const discard = vi.fn();
		const resource = makeResource({
			packageId: "package:late",
			disposeWithoutSaveFx: Effect.sync(discard),
		});
		const creation = Effect.runSync(Deferred.make<GameEngineResource>());
		const createResourceFx = vi.fn(() => Effect.uninterruptible(Deferred.await(creation)));
		const harness = createHarness(createResourceFx);
		const owner = harness.startLease("package:late");
		void owner.promise.catch(() => undefined);
		await vi.waitFor(() => expect(createResourceFx).toHaveBeenCalledOnce());

		const closing = owner.close();
		Effect.runSync(Deferred.succeed(creation, resource));
		await closing;

		expect(discard).toHaveBeenCalledOnce();
		expect(await harness.current()).toBeNull();
	});

	it("cleans acquiring and provisional resources when their service runtime shuts down", async () => {
		const interrupted = vi.fn();
		const acquiringHarness = createHarness(() =>
			Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(interrupted))),
		);
		const pending = acquiringHarness.startLease("package:pending");
		void pending.promise.catch(() => undefined);
		await acquiringHarness.runtime.dispose();
		runtimes.splice(runtimes.indexOf(acquiringHarness.runtime), 1);
		await vi.waitFor(() => expect(interrupted).toHaveBeenCalledOnce());
		await pending.close();

		const discard = vi.fn();
		const provisionalResource = makeResource({
			packageId: "package:provisional",
			disposeWithoutSaveFx: Effect.sync(discard),
		});
		const provisionalHarness = createHarness(() => Effect.succeed(provisionalResource));
		const provisional = provisionalHarness.startLease("package:provisional");
		expect((await provisional.promise).resource).toBe(provisionalResource);
		await provisionalHarness.runtime.dispose();
		runtimes.splice(runtimes.indexOf(provisionalHarness.runtime), 1);
		expect(discard).toHaveBeenCalledOnce();
		await provisional.close();
	});

	it("discards a different-package provisional resource before creating its successor", async () => {
		const discardFirst = vi.fn();
		const firstResource = makeResource({
			packageId: "package:first",
			disposeWithoutSaveFx: Effect.sync(discardFirst),
		});
		const secondResource = makeResource({
			packageId: "package:second",
		});
		const createResourceFx = vi.fn((packageId: string) =>
			Effect.succeed(packageId === "package:first" ? firstResource : secondResource),
		);
		const harness = createHarness(createResourceFx);
		const first = harness.startLease("package:first");
		const firstLease = await first.promise;
		const second = harness.startLease("package:second");
		const secondLease = await second.promise;

		expect(discardFirst).toHaveBeenCalledOnce();
		expect(createResourceFx).toHaveBeenCalledTimes(2);
		await expect(harness.adopt(firstLease)).rejects.toThrow("stale resource");
		await expect(harness.adopt(secondLease)).resolves.toBe(secondResource);
		await first.close();
		await second.close();
	});

	it("saves an active different-package resource before acquiring its successor", async () => {
		const order: Array<string> = [];
		const firstResource = makeResource({
			packageId: "package:first",
			disposeFx: Effect.sync(() => order.push("release:first")),
		});
		const secondResource = makeResource({
			packageId: "package:second",
		});
		const createResourceFx = vi.fn((packageId: string) =>
			Effect.sync(() => {
				order.push(`create:${packageId}`);
				return packageId === "package:first" ? firstResource : secondResource;
			}),
		);
		const harness = createHarness(createResourceFx);
		const first = harness.startLease("package:first");
		await harness.adopt(await first.promise);

		const second = harness.startLease("package:second");
		expect((await second.promise).resource).toBe(secondResource);
		expect(order).toEqual([
			"create:package:first",
			"release:first",
			"create:package:second",
		]);
		expect(createResourceFx).toHaveBeenCalledTimes(2);
		await first.close();
		await second.close();
	});

	it("keeps bootstrap failure sticky across package identities until explicit discard", async () => {
		const bootstrapFailure = new Error("bootstrap failed");
		const secondResource = makeResource({
			packageId: "package:second",
		});
		const createResourceFx = vi
			.fn()
			.mockReturnValueOnce(Effect.fail(bootstrapFailure))
			.mockReturnValueOnce(Effect.succeed(secondResource));
		const harness = createHarness(createResourceFx);
		const first = harness.startLease("package:first");
		await expect(first.promise).rejects.toBe(bootstrapFailure);
		await expect(harness.discardFailed("package:wrong")).rejects.toThrow(
			"exact failed bootstrap resource",
		);

		const blocked = harness.startLease("package:second");
		await expect(blocked.promise).rejects.toBe(bootstrapFailure);
		expect(createResourceFx).toHaveBeenCalledOnce();

		await harness.discardFailed("package:first");
		const second = harness.startLease("package:second");
		expect((await second.promise).resource).toBe(secondResource);
		expect(createResourceFx).toHaveBeenCalledTimes(2);
		await second.close();
	});

	it("replays bootstrap defects as defects until their failed state is discarded", async () => {
		const defect = new Error("bootstrap defect");
		const createResourceFx = vi.fn(() => Effect.die(defect));
		const harness = createHarness(createResourceFx);
		const first = harness.startLeaseExit("package:defect");
		const firstExit = await first.promise;
		const second = harness.startLeaseExit("package:other");
		const secondExit = await second.promise;

		expect(Exit.isFailure(firstExit)).toBe(true);
		expect(Exit.isFailure(secondExit)).toBe(true);
		if (Exit.isFailure(firstExit) && Exit.isFailure(secondExit)) {
			expect(Cause.hasDies(firstExit.cause)).toBe(true);
			expect(Cause.hasDies(secondExit.cause)).toBe(true);
			expect(Cause.squash(firstExit.cause)).toBe(defect);
			expect(Cause.squash(secondExit.cause)).toBe(defect);
			expect(Cause.findErrorOption(firstExit.cause)._tag).toBe("None");
			expect(Cause.findErrorOption(secondExit.cause)._tag).toBe("None");
		}
		expect(createResourceFx).toHaveBeenCalledOnce();
		await expect(harness.recoverFailedSave("package:defect")).rejects.toThrow(
			"exact verified bootstrap save failure",
		);
		await harness.discardFailed("package:defect");
		await first.close();
		await second.close();
	});

	it("rejects save recovery when bootstrap failure also contains a defect", async () => {
		const saveFailure = new GameSaveBootstrapError({
			cause: new Error("invalid save"),
			saveKey: {
				packageId: "package:mixed",
				contentHash: "c".repeat(64),
			},
		});
		const mixedCause = Cause.combine(
			Cause.fail(saveFailure),
			Cause.die(new Error("bootstrap defect")),
		);
		const clearSaveFx = vi.fn(() => Effect.void);
		const harness = createHarness(() => Effect.failCause(mixedCause), clearSaveFx);
		const failed = harness.startLeaseExit("package:mixed");
		const exit = await failed.promise;

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(Cause.hasFails(exit.cause)).toBe(true);
			expect(Cause.hasDies(exit.cause)).toBe(true);
		}
		await expect(harness.recoverFailedSave("package:mixed")).rejects.toThrow(
			"exact verified bootstrap save failure",
		);
		expect(clearSaveFx).not.toHaveBeenCalled();
		await harness.discardFailed("package:mixed");
		await failed.close();
	});

	it("replays a mixed critical bootstrap Cause without collapsing its defect", async () => {
		const criticalFailure = new CriticalGameLifecycleError({
			operation: "engine-ownership",
			cause: new Error("bootstrap ownership failure"),
		});
		const bootstrapDefect = new Error("bootstrap defect");
		const mixedCause = Cause.combine(Cause.fail(criticalFailure), Cause.die(bootstrapDefect));
		const creationGate = Effect.runSync(Deferred.make<void>());
		const createResourceFx = vi.fn(() =>
			Deferred.await(creationGate).pipe(Effect.andThen(Effect.failCause(mixedCause))),
		);
		const harness = createHarness(createResourceFx);
		const first = harness.startLeaseExit("package:mixed-critical");
		const closeClaim = harness.claimForClose();
		Effect.runSync(Deferred.succeed(creationGate, undefined));

		const firstExit = await first.promise;
		await expect(closeClaim).resolves.toBeNull();
		const second = harness.startLeaseExit("package:other");
		const secondExit = await second.promise;
		expect(Exit.isFailure(firstExit)).toBe(true);
		expect(Exit.isFailure(secondExit)).toBe(true);
		if (Exit.isFailure(firstExit) && Exit.isFailure(secondExit)) {
			expect(Cause.hasDies(firstExit.cause)).toBe(true);
			expect(Cause.hasDies(secondExit.cause)).toBe(true);
			expect(Cause.findErrorOption(firstExit.cause)).toEqual(Option.some(criticalFailure));
			expect(Cause.findErrorOption(secondExit.cause)).toEqual(Option.some(criticalFailure));
		}
		expect(createResourceFx).toHaveBeenCalledOnce();
		await harness.discardFailed("package:mixed-critical");
		await first.close();
		await second.close();
	});

	it("canonicalizes a provisional cleanup defect and blocks every successor", async () => {
		const cleanupDefect = new Error("provisional cleanup defect");
		const firstResource = makeResource({
			packageId: "package:first",
			disposeWithoutSaveFx: Effect.die(cleanupDefect),
		});
		const createResourceFx = vi.fn(() => Effect.succeed(firstResource));
		const harness = createHarness(createResourceFx);
		const first = harness.startLease("package:first");
		await first.promise;

		await first.close();
		const second = harness.startLease("package:second");
		const successorFailure = await second.promise.then(
			() => undefined,
			(cause: unknown) => cause,
		);
		const currentFailure = await harness.current().then(
			() => undefined,
			(cause: unknown) => cause,
		);
		expect(successorFailure).toBeInstanceOf(CriticalGameLifecycleError);
		expect(currentFailure).toBe(successorFailure);
		expect(successorFailure).toMatchObject({
			operation: "engine-ownership",
		});
		expect(() => firstResource.assertUsable()).toThrow(successorFailure);
		expect(createResourceFx).toHaveBeenCalledOnce();
	});

	it("preserves a mixed provisional cleanup Cause inside the sticky critical failure", async () => {
		const cleanupFailure = new Error("provisional cleanup failure");
		const cleanupDefect = new Error("provisional cleanup defect");
		const cleanupCause = Cause.combine(Cause.fail(cleanupFailure), Cause.die(cleanupDefect));
		const resource = makeResource({
			packageId: "package:mixed-cleanup",
			disposeWithoutSaveFx: Effect.failCause(cleanupCause),
		});
		const harness = createHarness(() => Effect.succeed(resource));
		const owner = harness.startLease("package:mixed-cleanup");
		await owner.promise;

		await owner.close();
		const successor = harness.startLease("package:successor");
		const successorFailure = await successor.promise.then(
			() => undefined,
			(cause: unknown) => cause,
		);
		expect(successorFailure).toBeInstanceOf(CriticalGameLifecycleError);
		expect((successorFailure as CriticalGameLifecycleError).operation).toBe("engine-ownership");
		const preservedCause = (successorFailure as CriticalGameLifecycleError).cause;
		expect(Cause.isCause(preservedCause)).toBe(true);
		if (Cause.isCause(preservedCause)) {
			expect(Cause.hasDies(preservedCause)).toBe(true);
			expect(Cause.findErrorOption(preservedCause)).toEqual(Option.some(cleanupFailure));
		}
		expect(() => resource.assertUsable()).toThrow(successorFailure);
	});

	it("preserves a mismatched resource's mixed cleanup Cause as the ownership failure", async () => {
		const cleanupFailure = new Error("mismatch cleanup failure");
		const cleanupDefect = new Error("mismatch cleanup defect");
		const cleanupCause = Cause.combine(Cause.fail(cleanupFailure), Cause.die(cleanupDefect));
		const wrongResource = makeResource({
			packageId: "package:wrong",
			disposeWithoutSaveFx: Effect.failCause(cleanupCause),
		});
		const createResourceFx = vi.fn(() => Effect.succeed(wrongResource));
		const harness = createHarness(createResourceFx);
		const mismatch = harness.startLease("package:expected");
		const mismatchFailure = await mismatch.promise.then(
			() => undefined,
			(cause: unknown) => cause,
		);

		expect(mismatchFailure).toBeInstanceOf(CriticalGameLifecycleError);
		expect((mismatchFailure as CriticalGameLifecycleError).operation).toBe("engine-ownership");
		const preservedCause = (mismatchFailure as CriticalGameLifecycleError).cause;
		expect(Cause.isCause(preservedCause)).toBe(true);
		if (Cause.isCause(preservedCause)) {
			expect(Cause.hasDies(preservedCause)).toBe(true);
			expect(Cause.findErrorOption(preservedCause)).toEqual(Option.some(cleanupFailure));
		}
		const blocked = harness.startLease("package:next");
		await expect(blocked.promise).rejects.toBe(mismatchFailure);
		expect(createResourceFx).toHaveBeenCalledOnce();
		await mismatch.close();
		await blocked.close();
	});

	it("joins one exact finalization result without retrying success or failure", async () => {
		const releaseGate = Effect.runSync(Deferred.make<void>());
		const dispose = vi.fn();
		const resource = makeResource({
			packageId: "package:first",
			disposeFx: Effect.sync(dispose).pipe(Effect.andThen(Deferred.await(releaseGate))),
		});
		const clearSave = vi.fn();
		const harness = createHarness(
			() => Effect.succeed(resource),
			() => Effect.sync(clearSave),
		);
		const leaseOwner = harness.startLease("package:first");
		const lease = await leaseOwner.promise;
		await harness.adopt(lease);

		const first = harness.release(resource);
		const second = harness.release(resource);
		await vi.waitFor(() => expect(dispose).toHaveBeenCalledOnce());
		await expect(harness.reset(resource)).rejects.toThrow(
			"cannot remove a different or missing singleton resource",
		);
		expect(clearSave).not.toHaveBeenCalled();
		Effect.runSync(Deferred.succeed(releaseGate, undefined));
		await expect(
			Promise.all([
				first,
				second,
			]),
		).resolves.toEqual([
			undefined,
			undefined,
		]);
		expect(dispose).toHaveBeenCalledOnce();
		expect(await harness.current()).toBeNull();
		await leaseOwner.close();

		const failedDispose = vi.fn();
		const failedReleaseGate = Effect.runSync(Deferred.make<void>());
		const releaseFailure = new Error("disk full");
		const failedResource = makeResource({
			packageId: "package:failed",
			disposeFx: Effect.sync(failedDispose).pipe(
				Effect.andThen(Deferred.await(failedReleaseGate)),
				Effect.andThen(Effect.fail(releaseFailure)),
			),
		});
		const createFailedResourceFx = vi.fn(() => Effect.succeed(failedResource));
		const failedHarness = createHarness(createFailedResourceFx);
		const failedOwner = failedHarness.startLease("package:failed");
		await failedHarness.adopt(await failedOwner.promise);
		const failedFirst = failedHarness.release(failedResource);
		const failedClose = failedHarness.close(failedResource);
		await vi.waitFor(() => expect(failedDispose).toHaveBeenCalledOnce());
		Effect.runSync(Deferred.succeed(failedReleaseGate, undefined));
		const firstFailure = await failedFirst.then(
			() => undefined,
			(cause: unknown) => cause,
		);
		const closeResult = await failedClose;
		expect(firstFailure).toBeInstanceOf(CriticalGameLifecycleError);
		expect(closeResult).toEqual({
			type: "finalization-failed",
			cause: firstFailure,
		});
		expect(firstFailure).toMatchObject({
			operation: "game-leave",
			cause: releaseFailure,
		});
		expect(failedDispose).toHaveBeenCalledOnce();
		await expect(failedHarness.current()).rejects.toBe(firstFailure);
		expect(() => failedResource.assertUsable()).toThrow(firstFailure);
		await expect(failedHarness.claimForClose()).resolves.toBe(failedResource);
		await expect(failedHarness.release(failedResource)).rejects.toBe(firstFailure);
		await expect(failedHarness.reset(failedResource)).rejects.toBe(firstFailure);
		const failedSamePackage = failedHarness.startLease("package:failed");
		const failedOtherPackage = failedHarness.startLease("package:next");
		await expect(failedSamePackage.promise).rejects.toBe(firstFailure);
		await expect(failedOtherPackage.promise).rejects.toBe(firstFailure);
		await expect(failedHarness.close(failedResource)).resolves.toEqual({
			type: "finalization-failed",
			cause: firstFailure,
		});
		expect(failedDispose).toHaveBeenCalledOnce();
		expect(createFailedResourceFx).toHaveBeenCalledOnce();
		await failedSamePackage.close();
		await failedOtherPackage.close();
		await failedOwner.close();
	});

	it("preserves a mixed finalization Cause inside one canonical fail-stop error", async () => {
		const finalSaveFailure = new Error("final save failed");
		const finalSaveDefect = new Error("final save defect");
		const finalSaveCause = Cause.combine(
			Cause.fail(finalSaveFailure),
			Cause.die(finalSaveDefect),
		);
		const resource = makeResource({
			packageId: "package:mixed-finalization",
			disposeFx: Effect.failCause(finalSaveCause),
		});
		const harness = createHarness(() => Effect.succeed(resource));
		const owner = harness.startLease("package:mixed-finalization");
		await harness.adopt(await owner.promise);

		const releaseFailure = await harness.release(resource).then(
			() => undefined,
			(cause: unknown) => cause,
		);
		expect(releaseFailure).toBeInstanceOf(CriticalGameLifecycleError);
		expect((releaseFailure as CriticalGameLifecycleError).operation).toBe("game-leave");
		const preservedCause = (releaseFailure as CriticalGameLifecycleError).cause;
		expect(Cause.isCause(preservedCause)).toBe(true);
		if (Cause.isCause(preservedCause)) {
			expect(Cause.hasDies(preservedCause)).toBe(true);
			expect(Cause.findErrorOption(preservedCause)).toEqual(Option.some(finalSaveFailure));
		}
		expect(() => resource.assertUsable()).toThrow(releaseFailure);
		await expect(harness.close(resource)).resolves.toEqual({
			type: "finalization-failed",
			cause: releaseFailure,
		});
		await owner.close();
	});

	it("lets native close join an in-flight reset without running final save", async () => {
		const discardStarted = vi.fn();
		const discardGate = Effect.runSync(Deferred.make<void>());
		const discard = vi.fn();
		const finalSave = vi.fn();
		const clearSave = vi.fn();
		const resource = makeResource({
			packageId: "package:reset-close",
			disposeFx: Effect.sync(finalSave),
			disposeWithoutSaveFx: Effect.sync(discardStarted).pipe(
				Effect.andThen(Deferred.await(discardGate)),
				Effect.andThen(Effect.sync(discard)),
			),
		});
		const harness = createHarness(
			() => Effect.succeed(resource),
			() => Effect.sync(clearSave),
		);
		const owner = harness.startLease("package:reset-close");
		await harness.adopt(await owner.promise);

		const reset = harness.reset(resource);
		await vi.waitFor(() => expect(discardStarted).toHaveBeenCalledOnce());
		const close = harness.close(resource);
		Effect.runSync(Deferred.succeed(discardGate, undefined));

		await expect(reset).resolves.toBeUndefined();
		await expect(close).resolves.toEqual({
			type: "saved",
		});
		expect(discard).toHaveBeenCalledOnce();
		expect(clearSave).toHaveBeenCalledOnce();
		expect(finalSave).not.toHaveBeenCalled();
		expect(await harness.current()).toBeNull();
		await owner.close();
	});

	it("closes one exact resource idempotently after its successful final save", async () => {
		const dispose = vi.fn();
		const resource = makeResource({
			packageId: "package:close",
			disposeFx: Effect.sync(dispose),
		});
		const harness = createHarness(() => Effect.succeed(resource));
		const owner = harness.startLease("package:close");
		await harness.adopt(await owner.promise);

		await expect(harness.close(resource)).resolves.toEqual({
			type: "saved",
		});
		await expect(harness.releaseAlreadyFinalized(resource)).resolves.toBeUndefined();
		await expect(harness.close(resource)).resolves.toEqual({
			type: "saved",
		});
		expect(dispose).toHaveBeenCalledOnce();
		expect(await harness.current()).toBeNull();
		await owner.close();
	});

	it("settles a close defect and keeps runtime shutdown best-effort", async () => {
		const disposeDefect = new Error("dispose getter defect");
		const resource = makeResource({
			packageId: "package:close-defect",
		});
		const harness = createHarness(() => Effect.succeed(resource));
		const owner = harness.startLease("package:close-defect");
		await harness.adopt(await owner.promise);
		Object.defineProperty(resource.game, "disposeFx", {
			configurable: true,
			get: () => {
				throw disposeDefect;
			},
		});

		const closeResult = await harness.close(resource);
		expect(closeResult.type).toBe("finalization-failed");
		if (closeResult.type === "finalization-failed") {
			expect(closeResult.cause).toBeInstanceOf(CriticalGameLifecycleError);
			expect(closeResult.cause).toMatchObject({
				operation: "game-leave",
			});
			const criticalCause = (closeResult.cause as CriticalGameLifecycleError).cause;
			expect(Cause.isCause(criticalCause)).toBe(true);
			if (Cause.isCause(criticalCause)) {
				expect(Cause.squash(criticalCause)).toBe(disposeDefect);
			}
			expect(() => resource.assertUsable()).toThrow(closeResult.cause);
		}
		await expect(harness.runtime.dispose()).resolves.toBeUndefined();
		runtimes.splice(runtimes.indexOf(harness.runtime), 1);
		await owner.close();
	});

	it("permanently fail-stops after reset cleanup fails", async () => {
		const discard = vi.fn();
		const resource = makeResource({
			packageId: "package:reset",
			disposeWithoutSaveFx: Effect.sync(discard),
		});
		const clearFailure = new Error("clear failed");
		const clearedKeys: Array<Game["saveKey"]> = [];
		const createResourceFx = vi.fn(() => Effect.succeed(resource));
		const harness = createHarness(createResourceFx, (key) =>
			Effect.suspend(() => {
				clearedKeys.push(key);
				return Effect.fail(clearFailure);
			}),
		);
		const owner = harness.startLease("package:reset");
		await harness.adopt(await owner.promise);

		const firstFailure = await harness.reset(resource).then(
			() => undefined,
			(cause: unknown) => cause,
		);
		expect(firstFailure).toBeInstanceOf(CriticalGameLifecycleError);
		expect(firstFailure).toMatchObject({
			operation: "game-reset",
			cause: clearFailure,
		});
		await expect(harness.current()).rejects.toBe(firstFailure);
		expect(() => resource.assertUsable()).toThrow(firstFailure);
		await expect(harness.claimForClose()).resolves.toBe(resource);

		await expect(harness.reset(resource)).rejects.toBe(firstFailure);
		await expect(harness.release(resource)).rejects.toBe(firstFailure);
		await expect(harness.recoverFailedSave("package:reset")).rejects.toBe(firstFailure);
		await expect(harness.discardFailed("package:reset")).rejects.toBe(firstFailure);
		const samePackage = harness.startLease("package:reset");
		const otherPackage = harness.startLease("package:other");
		await expect(samePackage.promise).rejects.toBe(firstFailure);
		await expect(otherPackage.promise).rejects.toBe(firstFailure);
		await expect(harness.close(resource)).resolves.toEqual({
			type: "finalization-failed",
			cause: firstFailure,
		});
		expect(discard).toHaveBeenCalledOnce();
		expect(clearedKeys).toEqual([
			resource.game.saveKey,
		]);
		expect(createResourceFx).toHaveBeenCalledOnce();
		await samePackage.close();
		await otherPackage.close();
		await owner.close();
	});

	it("claims pending creation for close and finalizes active resources on service disposal", async () => {
		const finalSave = vi.fn();
		const discard = vi.fn();
		const resource = makeResource({
			packageId: "package:first",
			disposeFx: Effect.sync(finalSave),
			disposeWithoutSaveFx: Effect.sync(discard),
		});
		const creation = Effect.runSync(Deferred.make<GameEngineResource>());
		const harness = createHarness(() => Deferred.await(creation));
		const routeLease = harness.startLease("package:first");
		void routeLease.promise.catch(() => undefined);
		const claimed = harness.claimForClose();
		Effect.runSync(Deferred.succeed(creation, resource));

		expect(await claimed).toBe(resource);
		await routeLease.close();
		expect(discard).not.toHaveBeenCalled();
		await harness.runtime.dispose();
		runtimes.splice(runtimes.indexOf(harness.runtime), 1);
		expect(finalSave).toHaveBeenCalledOnce();
		expect(discard).not.toHaveBeenCalled();
	});

	it("rolls back an interrupted close claim and disposes the last orphaned provisional resource", async () => {
		const discard = vi.fn();
		const resource = makeResource({
			packageId: "package:interrupted-close",
			disposeWithoutSaveFx: Effect.sync(discard),
		});
		const creation = Effect.runSync(Deferred.make<GameEngineResource>());
		const createResourceFx = vi.fn(() => Effect.uninterruptible(Deferred.await(creation)));
		const harness = createHarness(createResourceFx);
		const routeLease = harness.startLease("package:interrupted-close");
		void routeLease.promise.catch(() => undefined);
		await vi.waitFor(() => expect(createResourceFx).toHaveBeenCalledOnce());
		const closeClaim = harness.startCloseClaim();

		await routeLease.close();
		const interrupted = closeClaim.interrupt();
		Effect.runSync(Deferred.succeed(creation, resource));

		await interrupted;
		await closeClaim.exit;
		await vi.waitFor(() => expect(discard).toHaveBeenCalledOnce());
		expect(await harness.current()).toBeNull();
	});

	it("treats a defective pending bootstrap as no closeable resource", async () => {
		const creationGate = Effect.runSync(Deferred.make<void>());
		const harness = createHarness(() =>
			Deferred.await(creationGate).pipe(
				Effect.andThen(Effect.die(new Error("bootstrap defect"))),
			),
		);
		const routeLease = harness.startLease("package:defective-close");
		void routeLease.promise.catch(() => undefined);
		const claimed = harness.claimForClose();
		Effect.runSync(Deferred.succeed(creationGate, undefined));

		await expect(claimed).resolves.toBeNull();
		await routeLease.close();
	});

	it("discards mismatched creation and preserves exact failed-save recovery", async () => {
		const mismatchDiscard = vi.fn();
		const wrongResource = makeResource({
			packageId: "package:wrong",
			disposeWithoutSaveFx: Effect.sync(mismatchDiscard),
		});
		const mismatchCreate = vi.fn(() => Effect.succeed(wrongResource));
		const mismatchHarness = createHarness(mismatchCreate);
		const mismatch = mismatchHarness.startLease("package:expected");
		const mismatchFailure = await mismatch.promise.then(
			() => undefined,
			(cause: unknown) => cause,
		);
		expect(mismatchFailure).toBeInstanceOf(CriticalGameLifecycleError);
		expect(mismatchDiscard).toHaveBeenCalledOnce();
		const blocked = mismatchHarness.startLease("package:next");
		const blockedFailure = await blocked.promise.then(
			() => undefined,
			(cause: unknown) => cause,
		);
		expect(blockedFailure).toBe(mismatchFailure);
		expect(mismatchCreate).toHaveBeenCalledOnce();

		const saveFailure = new GameSaveBootstrapError({
			cause: new Error("invalid save"),
			saveKey: {
				packageId: "package:save",
				contentHash: "a".repeat(64),
			},
		});
		const recoveredResource = makeResource({
			packageId: "package:save",
		});
		const createAfterRecovery = vi
			.fn()
			.mockReturnValueOnce(Effect.fail(saveFailure))
			.mockReturnValueOnce(Effect.succeed(recoveredResource));
		const clearFailure = new Error("clear failed");
		const clear = vi.fn();
		const clearSaveFx = vi
			.fn()
			.mockReturnValueOnce(Effect.fail(clearFailure))
			.mockReturnValueOnce(Effect.sync(clear));
		const recoveryHarness = createHarness(createAfterRecovery, clearSaveFx);
		const failed = recoveryHarness.startLease("package:save");
		await expect(failed.promise).rejects.toBe(saveFailure);
		await expect(recoveryHarness.discardFailed("package:save")).rejects.toThrow(
			"Verified save failures",
		);
		await expect(recoveryHarness.recoverFailedSave("package:other")).rejects.toThrow(
			"package identity",
		);
		await expect(recoveryHarness.recoverFailedSave("package:save")).rejects.toThrow(
			"clear failed",
		);
		await recoveryHarness.recoverFailedSave("package:save");
		expect(clearSaveFx).toHaveBeenNthCalledWith(1, saveFailure.saveKey);
		expect(clearSaveFx).toHaveBeenNthCalledWith(2, saveFailure.saveKey);
		expect(clear).toHaveBeenCalledOnce();
		const recovered = recoveryHarness.startLease("package:save");
		expect((await recovered.promise).resource).toBe(recoveredResource);
		await recovered.close();
	});

	it("owns and joins failed-save recovery after one caller is interrupted", async () => {
		const saveFailure = new GameSaveBootstrapError({
			cause: new Error("invalid save"),
			saveKey: {
				packageId: "package:save",
				contentHash: "b".repeat(64),
			},
		});
		const recoveredResource = makeResource({
			packageId: "package:save",
		});
		const createResourceFx = vi
			.fn()
			.mockReturnValueOnce(Effect.fail(saveFailure))
			.mockReturnValueOnce(Effect.succeed(recoveredResource));
		const clearGate = Effect.runSync(Deferred.make<void>());
		const clearSaveFx = vi.fn(() => Deferred.await(clearGate));
		const harness = createHarness(createResourceFx, clearSaveFx);
		const failed = harness.startLease("package:save");
		await expect(failed.promise).rejects.toBe(saveFailure);

		const interruptedCaller = harness.startRecovery("package:save");
		void interruptedCaller.promise.catch(() => undefined);
		const joinedCaller = harness.recoverFailedSave("package:save");
		await vi.waitFor(() => expect(clearSaveFx).toHaveBeenCalledOnce());
		await interruptedCaller.interrupt();
		expect(clearSaveFx).toHaveBeenCalledOnce();

		Effect.runSync(Deferred.succeed(clearGate, undefined));
		await expect(joinedCaller).resolves.toBeUndefined();
		expect(clearSaveFx).toHaveBeenCalledWith(saveFailure.saveKey);
		const recovered = harness.startLease("package:save");
		expect((await recovered.promise).resource).toBe(recoveredResource);
		await recovered.close();
	});
});
