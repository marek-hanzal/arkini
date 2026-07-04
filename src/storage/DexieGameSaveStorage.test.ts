import { Effect } from "effect";
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { RuntimeGameEngineAdapter } from "~/engine/runtime/RuntimeGameEngineAdapter";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import {
	activeGameSaveId,
	gameSaveStorageSchemaVersion,
	type GameSaveStorageRecord,
} from "~/storage/GameSaveStorage";
import { DexieGameSaveStorage } from "~/storage/DexieGameSaveStorage";
import { hashRuntimeGameConfigFx } from "~/storage/hashRuntimeGameConfigFx";

const databaseNames = new Set<string>();

const createDatabaseName = () => {
	const name = `arkini-storage-test-${crypto.randomUUID()}`;
	databaseNames.add(name);
	return name;
};

const createInitialSave = async (): Promise<GameSave> => {
	const adapter = await RuntimeGameEngineAdapter.create({
		config: createEngineTestConfig(),
		nowMs: 0,
	});
	return adapter.readSave();
};

const withRawDatabase = async <T>(databaseName: string, fn: (database: Dexie) => Promise<T>) => {
	const database = new Dexie(databaseName);
	database.version(1).stores({
		saves: "&id, gameId, configHash, updatedAtMs",
	});
	try {
		return await fn(database);
	} finally {
		database.close();
	}
};

const putRawRecord = (databaseName: string, record: GameSaveStorageRecord) =>
	withRawDatabase(databaseName, (database) =>
		database.table<GameSaveStorageRecord, string>("saves").put(record),
	);

const countRawSaves = (databaseName: string) =>
	withRawDatabase(databaseName, (database) => database.table("saves").count());

afterEach(async () => {
	await Promise.all(
		[
			...databaseNames,
		].map((databaseName) => Dexie.delete(databaseName)),
	);
	databaseNames.clear();
});

describe("DexieGameSaveStorage", () => {
	it("roundtrips the active save document", async () => {
		const config = createEngineTestConfig();
		const configHash = await Effect.runPromise(hashRuntimeGameConfigFx(config));
		const save = await createInitialSave();
		const storage = new DexieGameSaveStorage({
			databaseName: createDatabaseName(),
		});

		await storage.saveActiveSave({
			config,
			configHash,
			save,
		});
		const loaded = await storage.loadActiveSave({
			config,
			configHash,
		});

		expect(loaded).toEqual(save);
		storage.close();
	});

	it("drops stored saves when the stored config hash does not match", async () => {
		const config = createEngineTestConfig();
		const configHash = await Effect.runPromise(hashRuntimeGameConfigFx(config));
		const databaseName = createDatabaseName();
		const save = await createInitialSave();
		const storage = new DexieGameSaveStorage({
			databaseName,
		});

		await storage.saveActiveSave({
			config,
			configHash,
			save,
		});

		await expect(
			storage.loadActiveSave({
				config,
				configHash: "different-config-hash",
			}),
		).resolves.toBeNull();
		await expect(countRawSaves(databaseName)).resolves.toBe(0);
		storage.close();
	});

	it("drops stored saves when the storage schema version does not match", async () => {
		const config = createEngineTestConfig();
		const configHash = await Effect.runPromise(hashRuntimeGameConfigFx(config));
		const databaseName = createDatabaseName();
		const save = await createInitialSave();
		const storage = new DexieGameSaveStorage({
			databaseName,
		});

		await putRawRecord(databaseName, {
			id: activeGameSaveId,
			configHash,
			gameId: config.game.id,
			save,
			saveVersion: save.version,
			schemaVersion: 0 as typeof gameSaveStorageSchemaVersion,
			updatedAtMs: save.updatedAtMs,
		});

		await expect(
			storage.loadActiveSave({
				config,
				configHash,
			}),
		).resolves.toBeNull();
		await expect(countRawSaves(databaseName)).resolves.toBe(0);
		storage.close();
	});

	it("drops stored saves for corrupt save payloads", async () => {
		const config = createEngineTestConfig();
		const configHash = await Effect.runPromise(hashRuntimeGameConfigFx(config));
		const databaseName = createDatabaseName();
		const storage = new DexieGameSaveStorage({
			databaseName,
		});

		await putRawRecord(databaseName, {
			id: activeGameSaveId,
			configHash,
			gameId: config.game.id,
			save: {
				obviously: "not a save",
			},
			saveVersion: 1,
			schemaVersion: gameSaveStorageSchemaVersion,
			updatedAtMs: 0,
		});

		await expect(
			storage.loadActiveSave({
				config,
				configHash,
			}),
		).resolves.toBeNull();
		await expect(countRawSaves(databaseName)).resolves.toBe(0);
		storage.close();
	});

	it("drops stored saves for semantically invalid save payloads", async () => {
		const config = createEngineTestConfig();
		const configHash = await Effect.runPromise(hashRuntimeGameConfigFx(config));
		const databaseName = createDatabaseName();
		const save = await createInitialSave();
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 4,
		};
		const storage = new DexieGameSaveStorage({
			databaseName,
		});

		await putRawRecord(databaseName, {
			id: activeGameSaveId,
			configHash,
			gameId: config.game.id,
			save,
			saveVersion: save.version,
			schemaVersion: gameSaveStorageSchemaVersion,
			updatedAtMs: save.updatedAtMs,
		});

		await expect(
			storage.loadActiveSave({
				config,
				configHash,
			}),
		).resolves.toBeNull();
		await expect(countRawSaves(databaseName)).resolves.toBe(0);
		storage.close();
	});

	it("deletes and wipes stored saves", async () => {
		const config = createEngineTestConfig();
		const configHash = await Effect.runPromise(hashRuntimeGameConfigFx(config));
		const save = await createInitialSave();
		const storage = new DexieGameSaveStorage({
			databaseName: createDatabaseName(),
		});

		await storage.saveActiveSave({
			config,
			configHash,
			save,
		});
		await storage.deleteActiveSave();
		await expect(
			storage.loadActiveSave({
				config,
				configHash,
			}),
		).resolves.toBeNull();

		await storage.saveActiveSave({
			config,
			configHash,
			save,
		});
		await storage.wipe();
		await expect(
			storage.loadActiveSave({
				config,
				configHash,
			}),
		).resolves.toBeNull();
		storage.close();
	});
});
