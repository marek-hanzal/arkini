import { Deferred, Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import { createArkpackCatalogFx } from "~/bridge/arkpack/createArkpackCatalogFx";

const builtIn: ArkpackDescriptor = {
	packageId: "arkini",
	contentHash: "a".repeat(64),
	gameId: "arkini",
	title: "Arkini",
	configVersion: "1",
	compressedSize: 1,
	trust: {
		type: "official",
		keyId: "test-official",
	} as const,
	source: "built-in",
};

const imported: ArkpackDescriptor = {
	packageId: "b".repeat(64),
	contentHash: "b".repeat(64),
	gameId: "imported",
	title: "Imported",
	configVersion: "1",
	compressedSize: 2,
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
				removeFx: () =>
					Effect.sync(() => {
						descriptors = [
							builtIn,
						];
					}),
			}),
		);
		const observed: string[] = [];
		catalog.subscribe(() => {
			observed.push(catalog.getSnapshot().type);
		});

		await Effect.runPromise(catalog.refreshFx);
		expect(catalog.getSnapshot()).toEqual({
			type: "ready",
			arkpacks: [
				builtIn,
			],
		});

		const descriptor = await Effect.runPromise(catalog.importFileFx({} as File));
		expect(descriptor).toBe(imported);
		expect(catalog.getSnapshot()).toEqual({
			type: "ready",
			arkpacks: [
				builtIn,
				imported,
			],
		});

		await Effect.runPromise(catalog.removeFx(imported.packageId));
		expect(catalog.getSnapshot()).toEqual({
			type: "ready",
			arkpacks: [
				builtIn,
			],
		});
		expect(list).toHaveBeenCalledTimes(3);
		expect(observed).toEqual([
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

		await expect(Effect.runPromise(catalog.refreshFx)).rejects.toThrow("catalog unavailable");
		const snapshot = catalog.getSnapshot();
		expect(snapshot.type).toBe("failed");
		if (snapshot.type !== "failed") throw new Error("Expected failed catalog snapshot.");
		expect(snapshot.error).toBe(failure);
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
						Effect.zipRight(Deferred.await(finishImport)),
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
						Effect.zipRight(Deferred.await(finishRemove)),
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
		expect(catalog.getSnapshot()).toEqual({
			type: "loading",
		});
		Effect.runSync(Deferred.succeed(finishImport, undefined));
		await expect(importing).resolves.toBe(imported);
		expect(catalog.getSnapshot()).toEqual({
			type: "ready",
			arkpacks: [
				builtIn,
				imported,
			],
		});

		const removing = Effect.runPromise(catalog.removeFx(imported.packageId));
		await Effect.runPromise(Deferred.await(removeStarted));
		expect(catalog.getSnapshot()).toEqual({
			type: "loading",
		});
		Effect.runSync(Deferred.succeed(finishRemove, undefined));
		await expect(removing).resolves.toBeUndefined();
		expect(catalog.getSnapshot()).toEqual({
			type: "ready",
			arkpacks: [
				builtIn,
			],
		});
	});
});
