import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { DexieArkpackStorage } from "~/bridge/arkpack/DexieArkpackStorage";
import { importArkpackFx } from "~/bridge/arkpack/importArkpackFx";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";
import { removeArkpackFx } from "~/bridge/arkpack/removeArkpackFx";
import { createTestArkpack } from "~test/bridge/arkpack/support/createTestArkpack";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const databaseName = "test-arkini-arkpacks";

afterEach(async () => {
	await Dexie.delete(databaseName);
});

describe("DexieArkpackStorage", () => {
	it("deduplicates exact binaries and restores a validated package after refresh", async () => {
		const storage = new DexieArkpackStorage(databaseName);
		try {
			const bytes = createTestArkpack();
			const first = await Effect.runPromise(
				importArkpackFx({
					bytes,
					filename: "first.arkpack",
					storage,
				}),
			);
			const second = await Effect.runPromise(
				importArkpackFx({
					bytes,
					filename: "second.arkpack",
					storage,
				}),
			);

			expect(second.packageId).toBe(first.packageId);
			expect(await storage.list()).toHaveLength(1);
			const loaded = await Effect.runPromise(
				loadArkpackFx({
					packageId: first.packageId,
					storage,
				}),
			);
			expect(loaded.descriptor.title).toBe("Bridge game");
			expect(loaded.payload.config.meta.id).toBe("game:bridge");

			await Effect.runPromise(
				removeArkpackFx({
					packageId: first.packageId,
					storage,
				}),
			);
			expect(await storage.list()).toEqual([]);
		} finally {
			storage.close();
		}
	});
});
