import { describe, expect, it, vi } from "vitest";
import { Deferred, Effect } from "effect";
import type { GameEngineResource } from "~/renderer/game/resource/GameEngineResource";
import type { GameEngineLease } from "~/renderer/game/resource/GameEngineResourceFx";

import { createHarness, makeResource, runtimes } from "./GameEngineResourceFx.test/fixture";

describe("GameEngineResourceFx / acquisition and scopes", () => {
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
});
