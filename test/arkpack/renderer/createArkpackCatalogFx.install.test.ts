import { Deferred, Effect, Fiber, SubscriptionRef } from "effect";
import { describe, expect, it } from "@effect/vitest";

import type { ArkpackDescriptor } from "~/arkpack/type/ArkpackDescriptor";
import { createArkpackCatalogFx } from "~/arkpack/renderer/createArkpackCatalogFx";
import { builtIn, imported } from "~test/arkpack/renderer/createArkpackCatalogFx.test/fixture";

describe("createArkpackCatalogFx install lifecycle", () => {
	it.effect("recovers canonical truth after a failed install and permits retry", () =>
		Effect.gen(function* () {
			let descriptors: ReadonlyArray<ArkpackDescriptor> = [
				builtIn,
			];
			let attempts = 0;
			const failure = new Error("disk unavailable");
			const catalog = yield* createArkpackCatalogFx({
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
				contentFx: Effect.succeed({
					bytes: new Uint8Array([
						1,
					]),
				}),
				expectedCurrent: null,
				filename: "imported.arkpack",
				packageId: imported.packageId,
			} as const;

			expect(yield* Effect.exit(catalog.installFx(request))).toEqual(
				expect.objectContaining({
					_tag: "Failure",
				}),
			);
			expect(yield* SubscriptionRef.get(catalog.state)).toEqual({
				type: "ready",
				arkpacks: [
					builtIn,
				],
			});

			expect(yield* catalog.installFx(request)).toBe(imported);
			expect(yield* SubscriptionRef.get(catalog.state)).toEqual({
				type: "ready",
				arkpacks: [
					builtIn,
					imported,
				],
			});
		}),
	);

	it.effect("settles success when recovery confirms a persisted install", () =>
		Effect.gen(function* () {
			let descriptors: ReadonlyArray<ArkpackDescriptor> = [
				builtIn,
			];
			let listAttempts = 0;
			const catalog = yield* createArkpackCatalogFx({
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
					contentFx: Effect.succeed({
						bytes: new Uint8Array([
							1,
						]),
					}),
					expectedCurrent: null,
					filename: "imported.arkpack",
					packageId: imported.packageId,
				}),
			).toBe(imported);
			expect(yield* SubscriptionRef.get(catalog.state)).toEqual({
				type: "ready",
				arkpacks: [
					builtIn,
					imported,
				],
			});
			expect(listAttempts).toBe(3);
		}),
	);

	it.effect("joins install content acquisition before reporting catalog idle", () =>
		Effect.gen(function* () {
			const contentStarted = yield* Deferred.make<void>();
			const releaseContent = yield* Deferred.make<void>();
			const catalog = yield* createArkpackCatalogFx({
				listFx: Effect.succeed([
					builtIn,
				]),
				installFx: () => Effect.succeed(imported),
			});
			yield* catalog.refreshFx;

			const installing = yield* catalog
				.installFx({
					contentFx: Deferred.succeed(contentStarted, undefined).pipe(
						Effect.andThen(Deferred.await(releaseContent)),
						Effect.as({
							bytes: new Uint8Array([
								1,
							]),
						}),
					),
					expectedCurrent: null,
					filename: "imported.arkpack",
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
