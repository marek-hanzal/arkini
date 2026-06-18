import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { RuntimeGameEngineAdapter } from "~/v0/game/engine/runtime/RuntimeGameEngineAdapter";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import {
	activeGameSaveId,
	DexieGameSaveStorage,
	gameSaveStorageSchemaVersion,
	hashRuntimeGameConfig,
	type GameSaveStorageRecord,
} from "~/v0/game/storage";

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

const putRawRecord = async (databaseName: string, record: GameSaveStorageRecord) => {
	const database = new Dexie(databaseName);
	database.version(1).stores({
		saves: "&id, gameId, configHash, updatedAtMs",
	});
	try {
		await database.table<GameSaveStorageRecord, string>("saves").put(record);
	} finally {
		database.close();
	}
};

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
		const configHash = await hashRuntimeGameConfig(config);
		const save = await createInitialSave();
		const storage = new DexieGameSaveStorage({
			databaseName: createDatabaseName(),
		});

		await storage.saveActiveSave({
			configHash,
			save,
		});
		const loaded = await storage.loadActiveSave({
			configHash,
			gameId: config.game.id,
		});

		expect(loaded).toEqual(save);
		storage.close();
	});

	it("returns null when the stored config hash does not match", async () => {
		const config = createEngineTestConfig();
		const configHash = await hashRuntimeGameConfig(config);
		const save = await createInitialSave();
		const storage = new DexieGameSaveStorage({
			databaseName: createDatabaseName(),
		});

		await storage.saveActiveSave({
			configHash,
			save,
		});

		await expect(
			storage.loadActiveSave({
				configHash: "different-config-hash",
				gameId: config.game.id,
			}),
		).resolves.toBeNull();
		storage.close();
	});

	it("returns null for corrupt save payloads", async () => {
		const config = createEngineTestConfig();
		const configHash = await hashRuntimeGameConfig(config);
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
				configHash,
				gameId: config.game.id,
			}),
		).resolves.toBeNull();
		storage.close();
	});

	it("deletes and wipes stored saves", async () => {
		const config = createEngineTestConfig();
		const configHash = await hashRuntimeGameConfig(config);
		const save = await createInitialSave();
		const storage = new DexieGameSaveStorage({
			databaseName: createDatabaseName(),
		});

		await storage.saveActiveSave({
			configHash,
			save,
		});
		await storage.deleteActiveSave();
		await expect(
			storage.loadActiveSave({
				configHash,
				gameId: config.game.id,
			}),
		).resolves.toBeNull();

		await storage.saveActiveSave({
			configHash,
			save,
		});
		await storage.wipe();
		await expect(
			storage.loadActiveSave({
				configHash,
				gameId: config.game.id,
			}),
		).resolves.toBeNull();
		storage.close();
	});
});
