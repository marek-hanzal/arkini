import { describe, expect, it, vi } from "vitest";
import { Cause, Effect, Option } from "effect";
import { CriticalGameLifecycleError } from "~/playable-game/error/CriticalGameLifecycleError";

import { createHarness, makeResource } from "./GameEngineResourceFx.test/fixture";

describe("GameEngineResourceFx / provisional cleanup", () => {
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
});
