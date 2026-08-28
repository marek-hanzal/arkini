import { Deferred, Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";

import { createHarness, makeResource } from "./GameEngineResourceFx.test/fixture";

describe("GameEngineResourceFx / Editor handoff", () => {
	it("returns an active Game to its save route and joins in-flight finalization", async () => {
		const finalizationStarted = Effect.runSync(Deferred.make<void>());
		const finalizationGate = Effect.runSync(Deferred.make<void>());
		const resource = makeResource({
			packageId: "package:active",
			disposeFx: Deferred.succeed(finalizationStarted, undefined).pipe(
				Effect.andThen(Deferred.await(finalizationGate)),
			),
		});
		const harness = createHarness(() => Effect.succeed(resource));
		const lease = harness.startLease("package:active");
		await harness.adopt(await lease.promise);

		expect(await harness.prepareEditorHandoff()).toBe(resource);
		const finalization = harness.release(resource);
		await Effect.runPromise(Deferred.await(finalizationStarted));
		const editorEntry = vi.fn();
		const handoff = harness.prepareEditorHandoff().then(editorEntry);

		expect(editorEntry).not.toHaveBeenCalled();
		Effect.runSync(Deferred.succeed(finalizationGate, undefined));
		await finalization;
		await handoff;

		expect(editorEntry).toHaveBeenCalledWith(null);
		await lease.close();
	});

	it("blocks Editor publication until provisional Game disposal completes", async () => {
		const disposalStarted = Effect.runSync(Deferred.make<void>());
		const disposalGate = Effect.runSync(Deferred.make<void>());
		const resource = makeResource({
			packageId: "package:provisional",
			disposeWithoutSaveFx: Deferred.succeed(disposalStarted, undefined).pipe(
				Effect.andThen(Deferred.await(disposalGate)),
			),
		});
		const harness = createHarness(() => Effect.succeed(resource));
		const lease = harness.startLease("package:provisional");
		await lease.promise;
		const publishEditorGame = vi.fn();

		const handoff = harness.prepareEditorHandoff().then(publishEditorGame);
		await Effect.runPromise(Deferred.await(disposalStarted));

		expect(publishEditorGame).not.toHaveBeenCalled();
		Effect.runSync(Deferred.succeed(disposalGate, undefined));
		await handoff;

		expect(publishEditorGame).toHaveBeenCalledOnce();
		expect(await harness.current()).toBeNull();
		await lease.close();
	});

	it("keeps failed provisional disposal visible and prevents Editor publication", async () => {
		const disposalFailure = new Error("provisional disposal failed");
		const resource = makeResource({
			packageId: "package:failed-disposal",
			disposeWithoutSaveFx: Effect.fail(disposalFailure),
		});
		const harness = createHarness(() => Effect.succeed(resource));
		const lease = harness.startLease("package:failed-disposal");
		await lease.promise;
		const publishEditorGame = vi.fn();

		const failure = await harness
			.prepareEditorHandoff()
			.then(publishEditorGame)
			.catch((cause: unknown) => cause);

		expect(failure).toBeInstanceOf(CriticalGameLifecycleError);
		expect(failure).toMatchObject({
			operation: "engine-ownership",
			cause: disposalFailure,
		});
		expect(publishEditorGame).not.toHaveBeenCalled();
		await expect(harness.current()).rejects.toBe(failure);
		await expect(harness.prepareEditorHandoff()).rejects.toBe(failure);
		await lease.close();
	});
});
