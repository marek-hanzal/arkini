import { Effect, Stream, SubscriptionRef } from "effect";
import { describe, expect, it, vi } from "vitest";
import { createArkpackCatalogFx } from "~/arkpack-catalog/fx/createArkpackCatalogFx";
import { builtIn, imported } from "~test/arkpack-catalog/fx/createArkpackCatalogFx.test/fixture";

describe("createArkpackCatalogFx state", () => {
	it("rejects a stale package snapshot before mutation without replacing ready truth", async () => {
		const install = vi.fn(() => Effect.succeed(imported));
		const catalog = Effect.runSync(
			createArkpackCatalogFx({
				listFx: Effect.succeed([
					builtIn,
				]),
				installFx: install,
			}),
		);
		await Effect.runPromise(catalog.refreshFx);

		await expect(
			Effect.runPromise(
				catalog.installFx({
					contentHash: builtIn.contentHash,
					expectedCurrent: {
						packageId: builtIn.packageId,
						contentHash: "f".repeat(64),
						version: builtIn.version,
					},
					expectedRevision: 1,
					packageId: builtIn.packageId,
				}),
			),
		).rejects.toThrow("changed before this action");
		expect(install).not.toHaveBeenCalled();
		expect(Effect.runSync(SubscriptionRef.get(catalog.state))).toEqual({
			type: "ready",
			arkpacks: [
				builtIn,
			],
		});
	});

	it("owns one refreshable catalog snapshot shared across import and remove", async () => {
		let descriptors = [
			builtIn,
		];
		const list = vi.fn(() => descriptors);
		const install = vi.fn(({ contentHash }: { readonly contentHash: string }) =>
			Effect.sync(() => {
				expect(contentHash).toBe(imported.contentHash);
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

		const descriptor = await Effect.runPromise(catalog.importFileFx());
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
					contentHash: imported.contentHash,
					expectedCurrent: null,
					expectedRevision: 1,
					packageId: imported.packageId,
				}),
			),
		).resolves.toBe(imported);
		expect(install).toHaveBeenCalledWith({
			contentHash: imported.contentHash,
			expectedRevision: 1,
			packageId: imported.packageId,
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
});
