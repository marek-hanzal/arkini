import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";

import { DexieGameSaveStorage } from "~/bridge/save/DexieGameSaveStorage";
import { StateSchema } from "~/engine/state/schema/StateSchema";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const databaseName = "test-arkini-game-saves";
const state = StateSchema.parse({
	currentSpace: 0,
	items: [],
	jobs: [],
});

afterEach(async () => {
	await Dexie.delete(databaseName);
});

describe("DexieGameSaveStorage", () => {
	it("namespaces saves by package and rejects stale package content", async () => {
		const storage = new DexieGameSaveStorage(databaseName);
		try {
			await storage.write({
				packageId: "package-a",
				contentHash: "hash-a",
				state,
			});
			expect(
				await storage.read({
					packageId: "package-a",
					contentHash: "hash-a",
				}),
			).toEqual(state);
			expect(
				await storage.read({
					packageId: "package-b",
					contentHash: "hash-a",
				}),
			).toBeNull();
			expect(
				await storage.read({
					packageId: "package-a",
					contentHash: "hash-b",
				}),
			).toBeNull();
		} finally {
			storage.close();
		}
	});
});
