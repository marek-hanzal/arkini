import { Cause, Deferred, Effect, Exit, Fiber, Stream, SubscriptionRef } from "effect";
import { describe, expect, it } from "@effect/vitest";
import type { ArkpackDescriptor } from "~/arkpack-catalog/type/ArkpackDescriptor";
import { createArkpackCatalogFx } from "~/arkpack-catalog/fx/createArkpackCatalogFx";
import { builtIn, imported } from "~test/arkpack-catalog/fx/createArkpackCatalogFx.test/fixture";

describe("createArkpackCatalogFx concurrency", () => {
	it.effect("settles an admitted operation before honoring caller interruption", () =>
		Effect.gen(function* () {
			let descriptors: ReadonlyArray<ArkpackDescriptor> = [
				builtIn,
			];
			const importStarted = yield* Deferred.make<void>();
			const finishImport = yield* Deferred.make<void>();
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
			});

			const importing = yield* catalog.importFileFx({} as File).pipe(Effect.forkChild);
			yield* Deferred.await(importStarted);
			const interrupted = yield* Fiber.interrupt(importing).pipe(Effect.forkChild);
			yield* Effect.yieldNow;
			expect(yield* SubscriptionRef.get(catalog.state)).toEqual({
				type: "loading",
			});

			yield* Deferred.succeed(finishImport, undefined);
			yield* Fiber.join(interrupted);
			const exit = yield* Fiber.await(importing);
			expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
			expect(yield* SubscriptionRef.get(catalog.state)).toEqual({
				type: "ready",
				arkpacks: [
					builtIn,
					imported,
				],
			});
		}),
	);

	it.effect(
		"serializes concurrent refresh, import, and remove without reordering catalog truth",
		() =>
			Effect.gen(function* () {
				let descriptors: ReadonlyArray<ArkpackDescriptor> = [
					builtIn,
				];
				let listAttempt = 0;
				const firstListStarted = yield* Deferred.make<void>();
				const releaseFirstList = yield* Deferred.make<void>();
				const order: string[] = [];
				const catalog = yield* createArkpackCatalogFx({
					listFx: Effect.gen(function* () {
						listAttempt += 1;
						order.push(`list:${listAttempt}`);
						if (listAttempt === 1) {
							yield* Deferred.succeed(firstListStarted, undefined);
							yield* Deferred.await(releaseFirstList);
						}
						return descriptors;
					}),
					importFileFx: () =>
						Effect.sync(() => {
							order.push("import");
							descriptors = [
								builtIn,
								imported,
							];
							return imported;
						}),
					removeFx: () =>
						Effect.sync(() => {
							order.push("remove");
							descriptors = [
								builtIn,
							];
						}),
				});
				const observed = yield* SubscriptionRef.changes(catalog.state).pipe(
					Stream.take(6),
					Stream.runCollect,
					Effect.forkChild,
				);

				const refreshing = yield* catalog.refreshFx.pipe(Effect.forkChild);
				yield* Deferred.await(firstListStarted);
				const importing = yield* catalog.importFileFx({} as File).pipe(Effect.forkChild);
				const removing = yield* catalog.removeFx(imported.packageId).pipe(Effect.forkChild);
				yield* Effect.yieldNow;
				expect(order).toEqual([
					"list:1",
				]);

				yield* Deferred.succeed(releaseFirstList, undefined);
				yield* Fiber.join(refreshing);
				yield* Fiber.join(importing);
				yield* Fiber.join(removing);

				expect(order).toEqual([
					"list:1",
					"import",
					"list:2",
					"remove",
					"list:3",
				]);
				expect((yield* Fiber.join(observed)).map((state) => state.type)).toEqual([
					"loading",
					"ready",
					"loading",
					"ready",
					"loading",
					"ready",
				]);
				expect(yield* SubscriptionRef.get(catalog.state)).toEqual({
					type: "ready",
					arkpacks: [
						builtIn,
					],
				});
			}),
	);
});
