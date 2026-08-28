import { describe, expect, it, vi } from "vitest";
import { Deferred, Effect } from "effect";
import type { Game } from "~/renderer/game/Game";
import { CriticalGameLifecycleError } from "~/renderer/game/resource/CriticalGameLifecycleError";
import type { GameEngineResource } from "~/renderer/game/resource/GameEngineResource";

import { createHarness, makeResource, runtimes } from "./GameEngineResourceFx.test/fixture";

describe("GameEngineResourceFx / reset and disposal", () => {
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
});
