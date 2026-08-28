import { describe, expect, it, vi } from "vitest";
import { Cause, Deferred, Effect, Exit, Option } from "effect";
import { GameSaveBootstrapError } from "~/renderer/game/GameSaveBootstrapError";
import { CriticalGameLifecycleError } from "~/renderer/game/resource/CriticalGameLifecycleError";

import { createHarness, makeResource } from "./GameEngineResourceFx.test/fixture";

describe("GameEngineResourceFx / bootstrap failure", () => {
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
});
