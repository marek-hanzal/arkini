import { Cause, Deferred, Effect, Exit, Fiber, SubscriptionRef } from "effect";
import { describe, expect, it } from "@effect/vitest";
import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import { createArkpackCatalogFx } from "~/bridge/arkpack/createArkpackCatalogFx";
import { builtIn, imported } from "~test/bridge/arkpack/createArkpackCatalogFx.test/fixture";

describe("createArkpackCatalogFx lifecycle", () => {
	it.effect("settles a malformed import defect and permits an exact retry", () =>
		Effect.gen(function* () {
			let descriptors: ReadonlyArray<ArkpackDescriptor> = [
				builtIn,
			];
			let attempts = 0;
			const malformed = new Error("Invalid pack: magic header mismatch.");
			const catalog = yield* createArkpackCatalogFx({
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
			});

			const first = yield* Effect.exit(catalog.importFileFx({} as File));
			expect(Exit.isFailure(first)).toBe(true);
			if (Exit.isFailure(first)) {
				expect(Cause.hasDies(first.cause)).toBe(true);
				expect(Cause.squash(first.cause)).toBe(malformed);
			}
			expect(yield* SubscriptionRef.get(catalog.state)).toEqual({
				type: "failed",
				error: malformed,
			});

			expect(yield* catalog.importFileFx({} as File)).toBe(imported);
			expect(yield* SubscriptionRef.get(catalog.state)).toEqual({
				type: "ready",
				arkpacks: [
					builtIn,
					imported,
				],
			});
		}),
	);

	it.effect("publishes loading before import and remove operations complete", () =>
		Effect.gen(function* () {
			let descriptors: ReadonlyArray<ArkpackDescriptor> = [
				builtIn,
			];
			const importStarted = yield* Deferred.make<void>();
			const finishImport = yield* Deferred.make<void>();
			const removeStarted = yield* Deferred.make<void>();
			const finishRemove = yield* Deferred.make<void>();
			const catalog = yield* createArkpackCatalogFx({
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
			});
			yield* catalog.refreshFx;

			const importing = yield* catalog.importFileFx({} as File).pipe(Effect.forkChild);
			yield* Deferred.await(importStarted);
			expect(yield* SubscriptionRef.get(catalog.state)).toEqual({
				type: "loading",
			});
			const idleSettled = yield* Deferred.make<void>();
			const waitingForIdle = yield* catalog.awaitIdleFx.pipe(
				Effect.andThen(Deferred.succeed(idleSettled, undefined)),
				Effect.forkChild,
			);
			yield* Effect.yieldNow;
			expect(yield* Deferred.isDone(idleSettled)).toBe(false);
			yield* Deferred.succeed(finishImport, undefined);
			expect(yield* Fiber.join(importing)).toBe(imported);
			yield* Fiber.join(waitingForIdle);
			expect(yield* Deferred.isDone(idleSettled)).toBe(true);
			expect(yield* SubscriptionRef.get(catalog.state)).toEqual({
				type: "ready",
				arkpacks: [
					builtIn,
					imported,
				],
			});

			const removing = yield* catalog.removeFx(imported.packageId).pipe(Effect.forkChild);
			yield* Deferred.await(removeStarted);
			expect(yield* SubscriptionRef.get(catalog.state)).toEqual({
				type: "loading",
			});
			yield* Deferred.succeed(finishRemove, undefined);
			expect(yield* Fiber.join(removing)).toBeUndefined();
			expect(yield* SubscriptionRef.get(catalog.state)).toEqual({
				type: "ready",
				arkpacks: [
					builtIn,
				],
			});
		}),
	);
});
