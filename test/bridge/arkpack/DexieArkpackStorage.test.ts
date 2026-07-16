import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import { DexieArkpackStorage } from "~/bridge/arkpack/DexieArkpackStorage";
import { importArkpackFx } from "~/bridge/arkpack/importArkpackFx";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";
import { removeArkpackFx } from "~/bridge/arkpack/removeArkpackFx";
import { createTestArkpack } from "~test/bridge/arkpack/support/createTestArkpack";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const databaseName = "test-arkini-arkpacks";

const descriptor = (
	packageId: string,
	importedAtMs: number,
	compressedSize: number,
): ArkpackDescriptor => ({
	packageId,
	contentHash: packageId,
	gameId: `game:${packageId}`,
	title: packageId,
	configVersion: "1.0",
	compressedSize,
	source: "imported",
	filename: `${packageId}.arkpack`,
	importedAtMs,
});

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
			expect(await storage.read(first.packageId)).toBeUndefined();
		} finally {
			storage.close();
		}
	});

	it("lists only deterministic metadata while exact read loads one selected payload", async () => {
		const storage = new DexieArkpackStorage(databaseName);
		try {
			const payloadSize = 2 * 1024 * 1024;
			for (const [packageId, importedAtMs] of [
				[
					"package-c",
					2,
				],
				[
					"package-b",
					3,
				],
				[
					"package-a",
					3,
				],
			] as const) {
				await storage.write(
					descriptor(packageId, importedAtMs, payloadSize),
					new Uint8Array(payloadSize).buffer,
				);
			}

			const listed = await storage.list();
			expect(listed.map(({ packageId }) => packageId)).toEqual([
				"package-a",
				"package-b",
				"package-c",
			]);
			for (const entry of listed) {
				expect(entry).not.toHaveProperty("bytes");
				expect(entry.compressedSize).toBe(payloadSize);
			}

			const loaded = await storage.read("package-b");
			expect(loaded?.descriptor.packageId).toBe("package-b");
			expect(loaded?.bytes.byteLength).toBe(payloadSize);
		} finally {
			storage.close();
		}
	});

	it("migrates legacy combined records into metadata and payload tables", async () => {
		const bytes = new Uint8Array([
			1,
			2,
			3,
			4,
		]).buffer;
		const legacy = new Dexie(databaseName);
		legacy.version(1).stores({
			arkpacks: "&packageId, gameId, title, importedAtMs",
		});
		await legacy.table("arkpacks").put({
			packageId: "legacy",
			contentHash: "legacy",
			gameId: "game:legacy",
			title: "Legacy",
			configVersion: "1.0",
			source: "imported",
			filename: "legacy.arkpack",
			importedAtMs: 1,
			bytes,
		});
		legacy.close();

		const storage = new DexieArkpackStorage(databaseName);
		try {
			const listed = await storage.list();
			expect(listed).toEqual([
				expect.objectContaining({
					packageId: "legacy",
					compressedSize: 4,
				}),
			]);
			expect(listed[0]).not.toHaveProperty("bytes");
			expect((await storage.read("legacy"))?.bytes).toEqual(bytes);
		} finally {
			storage.close();
		}
	});

	it("does not persist either metadata or payload when validation fails", async () => {
		const storage = new DexieArkpackStorage(databaseName);
		try {
			await expect(
				Effect.runPromise(
					importArkpackFx({
						bytes: new Uint8Array([
							1,
							2,
							3,
						]),
						filename: "invalid.arkpack",
						storage,
					}),
				),
			).rejects.toBeDefined();
			expect(await storage.list()).toEqual([]);
		} finally {
			storage.close();
		}
	});
});
