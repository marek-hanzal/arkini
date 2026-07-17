import { Effect } from "effect";
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
	source: "built-in",
};

const imported: ArkpackDescriptor = {
	packageId: "b".repeat(64),
	contentHash: "b".repeat(64),
	gameId: "imported",
	title: "Imported",
	configVersion: "1",
	compressedSize: 2,
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
		expect(catalog.getSnapshot()).toEqual({
			type: "failed",
			error: failure,
		});
	});
});
