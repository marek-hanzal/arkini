import { Deferred, Effect, Fiber, SubscriptionRef } from "effect";
import { describe, expect, it } from "@effect/vitest";

import type { SerapackDescriptor } from "~/serapack-catalog/type/SerapackDescriptor";
import { createSerapackCatalogFx } from "~/serapack-catalog/fx/createSerapackCatalogFx";
import { builtIn, imported } from "~test/serapack-catalog/fx/createSerapackCatalogFx.test/fixture";

describe("createSerapackCatalogFx install lifecycle", () => {
	it.effect("recovers canonical truth after a failed install and permits retry", () =>
		Effect.gen(function* () {
			let descriptors: ReadonlyArray<SerapackDescriptor> = [
				builtIn,
			];
			let attempts = 0;
			const failure = new Error("disk unavailable");
			const catalog = yield* createSerapackCatalogFx({
				listFx: Effect.sync(() => descriptors),
				installFx: () =>
					Effect.suspend(() => {
						attempts += 1;
						if (attempts === 1) return Effect.fail(failure);
						descriptors = [
							builtIn,
							imported,
						];
						return Effect.succeed(imported);
					}),
			});
			yield* catalog.refreshFx;
			const request = {
				contentHash: imported.contentHash,
				expectedCurrent: null,
				expectedRevision: 1,
				packageId: imported.packageId,
			} as const;

			expect(yield* Effect.exit(catalog.installFx(request))).toEqual(
				expect.objectContaining({
					_tag: "Failure",
				}),
			);
			expect(yield* SubscriptionRef.get(catalog.state)).toEqual({
				type: "ready",
				serapacks: [
					builtIn,
				],
			});

			expect(yield* catalog.installFx(request)).toBe(imported);
			expect(yield* SubscriptionRef.get(catalog.state)).toEqual({
				type: "ready",
				serapacks: [
					builtIn,
					imported,
				],
			});
		}),
	);

	it.effect("settles success when recovery confirms a persisted install", () =>
		Effect.gen(function* () {
			let descriptors: ReadonlyArray<SerapackDescriptor> = [
				builtIn,
			];
			let listAttempts = 0;
			const catalog = yield* createSerapackCatalogFx({
				listFx: Effect.suspend(() => {
					listAttempts += 1;
					return listAttempts === 2
						? Effect.fail(new Error("refresh interrupted"))
						: Effect.succeed(descriptors);
				}),
				installFx: () =>
					Effect.sync(() => {
						descriptors = [
							builtIn,
							imported,
						];
						return imported;
					}),
			});
			yield* catalog.refreshFx;

			expect(
				yield* catalog.installFx({
					contentHash: imported.contentHash,
					expectedCurrent: null,
					expectedRevision: 1,
					packageId: imported.packageId,
				}),
			).toBe(imported);
			expect(yield* SubscriptionRef.get(catalog.state)).toEqual({
				type: "ready",
				serapacks: [
					builtIn,
					imported,
				],
			});
			expect(listAttempts).toBe(3);
		}),
	);

	it.effect("joins installation before reporting catalog idle", () =>
		Effect.gen(function* () {
			const contentStarted = yield* Deferred.make<void>();
			const releaseContent = yield* Deferred.make<void>();
			const catalog = yield* createSerapackCatalogFx({
				listFx: Effect.succeed([
					builtIn,
				]),
				installFx: () =>
					Deferred.succeed(contentStarted, undefined).pipe(
						Effect.andThen(Deferred.await(releaseContent)),
						Effect.as(imported),
					),
			});
			yield* catalog.refreshFx;

			const installing = yield* catalog
				.installFx({
					contentHash: imported.contentHash,
					expectedCurrent: null,
					expectedRevision: 1,
					packageId: imported.packageId,
				})
				.pipe(Effect.forkChild);
			yield* Deferred.await(contentStarted);
			const idleSettled = yield* Deferred.make<void>();
			const waitingForIdle = yield* catalog.awaitIdleFx.pipe(
				Effect.andThen(Deferred.succeed(idleSettled, undefined)),
				Effect.forkChild,
			);
			yield* Effect.yieldNow;
			expect(yield* Deferred.isDone(idleSettled)).toBe(false);

			yield* Deferred.succeed(releaseContent, undefined);
			yield* Fiber.join(installing);
			yield* Fiber.join(waitingForIdle);
			expect(yield* Deferred.isDone(idleSettled)).toBe(true);
		}),
	);
});
