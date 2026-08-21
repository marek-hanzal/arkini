import { describe, expect, it, vi } from "vitest";
import { Deferred, Effect } from "effect";
import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";

import { createHarness, makeResource } from "./GameEngineResourceFx.test/fixture";

describe("GameEngineResourceFx / failed-save recovery", () => {
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
