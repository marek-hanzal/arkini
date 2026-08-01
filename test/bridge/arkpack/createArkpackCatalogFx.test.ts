import { Cause, Deferred, Effect, Exit, Fiber, Stream, SubscriptionRef } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import { createArkpackCatalogFx } from "~/bridge/arkpack/createArkpackCatalogFx";

const builtIn: ArkpackDescriptor = {
	packageId: "arkini",
	hash: "a".repeat(64),
	gameId: "arkini",
	title: "Arkini",
	game: "1",
	trust: {
		type: "official",
		keyId: "test-official",
	} as const,
	source: "built-in",
};

const imported: ArkpackDescriptor = {
	packageId: "b".repeat(64),
	hash: "b".repeat(64),
	gameId: "imported",
	title: "Imported",
	game: "1",
	trust: {
		type: "external",
		reason: "unsigned",
	} as const,
	source: "imported",
};

describe("createArkpackCatalogFx", () => {
	it("owns one refreshable catalog snapshot shared across import and remove", async () => {
		let descriptors: ReadonlyArray<ArkpackDescriptor> = [
			builtIn,
		];
		const list = vi.fn(() => descriptors);
		const install = vi.fn(({ bytes }: { readonly bytes: Uint8Array }) =>
			Effect.sync(() => {
				expect(bytes).toEqual(
					new Uint8Array([
						1,
					]),
				);
				descriptors = [
					builtIn,
					imported,
				];
				return imported;
			}),
		);
		const catalog = Effect.runSync(
			createArkpackCatalogFx({
				listFx: Effect.sync(list),
				importFileFx: () =>
					Effect.sync(() => {
						descriptors = [
							builtIn,
							imported,
						];
						return imported;
					}),
				installFx: install,
				removeFx: () =>
					Effect.sync(() => {
						descriptors = [
							builtIn,
						];
					}),
			}),
		);
		const observed = Effect.runPromise(
			SubscriptionRef.changes(catalog.state).pipe(Stream.take(8), Stream.runCollect),
		);
		await Effect.runPromise(catalog.refreshFx);
		expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
			type: "ready",
			arkpacks: [
				builtIn,
			],
		});

		const descriptor = await Effect.runPromise(catalog.importFileFx({} as File));
		expect(descriptor).toBe(imported);
		expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
			type: "ready",
			arkpacks: [
				builtIn,
				imported,
			],
		});

		await Effect.runPromise(catalog.removeFx(imported.packageId));
		expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
			type: "ready",
			arkpacks: [
				builtIn,
			],
		});

		await expect(
			Effect.runPromise(
				catalog.installFx({
					bytes: new Uint8Array([
						1,
					]),
					filename: "built.arkpack",
				}),
			),
		).resolves.toBe(imported);
		expect(install).toHaveBeenCalledWith({
			bytes: new Uint8Array([
				1,
			]),
			filename: "built.arkpack",
		});
		expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
			type: "ready",
			arkpacks: [
				builtIn,
				imported,
			],
		});
		expect(list).toHaveBeenCalledTimes(4);
		expect((await observed).map((state) => state.type)).toEqual([
			"loading",
			"ready",
			"loading",
			"ready",
			"loading",
			"ready",
			"loading",
			"ready",
		]);
	});

	it("publishes the same failed request that rejects its caller", async () => {
		const failure = new Error("catalog unavailable");
		const catalog = Effect.runSync(
			createArkpackCatalogFx({
				listFx: Effect.fail(failure),
			}),
		);
		const observed = Effect.runPromise(
			SubscriptionRef.changes(catalog.state).pipe(Stream.take(2), Stream.runCollect),
		);

		await expect(Effect.runPromise(catalog.refreshFx)).rejects.toThrow("catalog unavailable");
		const snapshot = Effect.runSync(SubscriptionRef.get(catalog.state));
		expect(snapshot.type).toBe("failed");
		if (snapshot.type !== "failed") throw new Error("Expected failed catalog snapshot.");
		expect(snapshot.error).toBe(failure);
		expect((await observed).map((state) => state.type)).toEqual([
			"loading",
			"failed",
		]);
	});

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
