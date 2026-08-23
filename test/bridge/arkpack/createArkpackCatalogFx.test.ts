import { Effect, Stream, SubscriptionRef } from "effect";
import { describe, expect, it, vi } from "vitest";
import { createArkpackCatalogFx } from "~/bridge/arkpack/createArkpackCatalogFx";
import { builtIn, imported } from "~test/bridge/arkpack/createArkpackCatalogFx.test/fixture";

describe("createArkpackCatalogFx state", () => {
	it("owns one refreshable catalog snapshot shared across import and remove", async () => {
		let descriptors = [
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
});
