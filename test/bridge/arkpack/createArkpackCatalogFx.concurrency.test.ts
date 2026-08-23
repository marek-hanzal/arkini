import { Cause, Deferred, Effect, Exit, Fiber, Stream, SubscriptionRef } from "effect";
import { describe, expect, it } from "vitest";
import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import { createArkpackCatalogFx } from "~/bridge/arkpack/createArkpackCatalogFx";
import { builtIn, imported } from "~test/bridge/arkpack/createArkpackCatalogFx.test/fixture";

describe("createArkpackCatalogFx concurrency", () => {
	it("settles an admitted operation before honoring caller interruption", async () => {
		let descriptors: ReadonlyArray<ArkpackDescriptor> = [
			builtIn,
		];
		const importStarted = Effect.runSync(Deferred.make<void>());
		const finishImport = Effect.runSync(Deferred.make<void>());
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
			}),
		);

		const importing = Effect.runFork(catalog.importFileFx({} as File));
		await Effect.runPromise(Deferred.await(importStarted));
		const interrupted = Effect.runPromise(Fiber.interrupt(importing));
		await Promise.resolve();
		expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
			type: "loading",
		});

		Effect.runSync(Deferred.succeed(finishImport, undefined));
		await interrupted;
		const exit = await Effect.runPromise(Fiber.await(importing));
		expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
		expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
			type: "ready",
			arkpacks: [
				builtIn,
				imported,
			],
		});
	});

	it("serializes concurrent refresh, import, and remove without reordering catalog truth", async () => {
		let descriptors: ReadonlyArray<ArkpackDescriptor> = [
			builtIn,
		];
		let listAttempt = 0;
		const firstListStarted = Effect.runSync(Deferred.make<void>());
		const releaseFirstList = Effect.runSync(Deferred.make<void>());
		const order: string[] = [];
		const catalog = Effect.runSync(
			createArkpackCatalogFx({
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
			}),
		);
		const observed = Effect.runPromise(
			SubscriptionRef.changes(catalog.state).pipe(Stream.take(6), Stream.runCollect),
		);

		const refreshing = Effect.runPromise(catalog.refreshFx);
		await Effect.runPromise(Deferred.await(firstListStarted));
		const importing = Effect.runPromise(catalog.importFileFx({} as File));
		const removing = Effect.runPromise(catalog.removeFx(imported.packageId));
		await Promise.resolve();
		expect(order).toEqual([
			"list:1",
		]);

		Effect.runSync(Deferred.succeed(releaseFirstList, undefined));
		await Promise.all([
			refreshing,
			importing,
			removing,
		]);

		expect(order).toEqual([
			"list:1",
			"import",
			"list:2",
			"remove",
			"list:3",
		]);
		expect((await observed).map((state) => state.type)).toEqual([
			"loading",
			"ready",
			"loading",
			"ready",
			"loading",
			"ready",
		]);
		expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
			type: "ready",
			arkpacks: [
				builtIn,
			],
		});
	});
});
