import { Cause, Deferred, Effect, Exit, SubscriptionRef } from "effect";
import { describe, expect, it } from "vitest";
import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import { createArkpackCatalogFx } from "~/bridge/arkpack/createArkpackCatalogFx";
import { builtIn, imported } from "~test/bridge/arkpack/createArkpackCatalogFx.test/fixture";

describe("createArkpackCatalogFx lifecycle", () => {
	it("settles a malformed import defect and permits an exact retry", async () => {
		let descriptors: ReadonlyArray<ArkpackDescriptor> = [
			builtIn,
		];
		let attempts = 0;
		const malformed = new Error("Invalid pack: magic header mismatch.");
		const catalog = Effect.runSync(
			createArkpackCatalogFx({
				listFx: Effect.sync(() => descriptors),
				importFileFx: () =>
					Effect.suspend(() => {
						attempts += 1;
						if (attempts === 1) return Effect.die(malformed);
						descriptors = [
							builtIn,
							imported,
						];
						return Effect.succeed(imported);
					}),
			}),
		);

		const first = await Effect.runPromiseExit(catalog.importFileFx({} as File));
		expect(Exit.isFailure(first)).toBe(true);
		if (Exit.isFailure(first)) {
			expect(Cause.hasDies(first.cause)).toBe(true);
			expect(Cause.squash(first.cause)).toBe(malformed);
		}
		expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
			type: "failed",
			error: malformed,
		});

		await expect(catalog.importFileFx({} as File).pipe(Effect.runPromise)).resolves.toBe(
			imported,
		);
		expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
			type: "ready",
			arkpacks: [
				builtIn,
				imported,
			],
		});
	});

	it("publishes loading before import and remove operations complete", async () => {
		let descriptors: ReadonlyArray<ArkpackDescriptor> = [
			builtIn,
		];
		const importStarted = Effect.runSync(Deferred.make<void>());
		const finishImport = Effect.runSync(Deferred.make<void>());
		const removeStarted = Effect.runSync(Deferred.make<void>());
		const finishRemove = Effect.runSync(Deferred.make<void>());
		const catalog = Effect.runSync(
			createArkpackCatalogFx({
				listFx: Effect.sync(() => descriptors),
				importFileFx: () =>
					Deferred.succeed(importStarted, undefined).pipe(
						Effect.andThen(Deferred.await(finishImport)),
						Effect.tap(() =>
							Effect.sync(() => {
								descriptors = [
									builtIn,
									imported,
								];
							}),
						),
						Effect.as(imported),
					),
				removeFx: () =>
					Deferred.succeed(removeStarted, undefined).pipe(
						Effect.andThen(Deferred.await(finishRemove)),
						Effect.tap(() =>
							Effect.sync(() => {
								descriptors = [
									builtIn,
								];
							}),
						),
					),
			}),
		);
		await Effect.runPromise(catalog.refreshFx);

		const importing = Effect.runPromise(catalog.importFileFx({} as File));
		await Effect.runPromise(Deferred.await(importStarted));
		expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
			type: "loading",
		});
		let idle = false;
		const waitingForIdle = Effect.runPromise(catalog.awaitIdleFx).then(() => {
			idle = true;
		});
		await Promise.resolve();
		expect(idle).toBe(false);
		Effect.runSync(Deferred.succeed(finishImport, undefined));
		await expect(importing).resolves.toBe(imported);
		await waitingForIdle;
		expect(idle).toBe(true);
		expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
			type: "ready",
			arkpacks: [
				builtIn,
				imported,
			],
		});

		const removing = Effect.runPromise(catalog.removeFx(imported.packageId));
		await Effect.runPromise(Deferred.await(removeStarted));
		expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
			type: "loading",
		});
		Effect.runSync(Deferred.succeed(finishRemove, undefined));
		await expect(removing).resolves.toBeUndefined();
		expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
			type: "ready",
			arkpacks: [
				builtIn,
			],
		});
	});
});
