import { describe, expect, it, vi } from "vitest";
import { Cause, Deferred, Effect, Option } from "effect";
import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";

import { createHarness, makeResource, runtimes } from "./GameEngineResourceFx.test/fixture";

describe("GameEngineResourceFx / finalization", () => {
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
		Object.defineProperty(resource.session, "disposeFx", {
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
});
