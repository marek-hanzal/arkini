import Dexie, { type Table } from "dexie";
import { GameSaveSchema, type GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import {
	activeGameSaveId,
	gameSaveStorageSchemaVersion,
	type CloseableGameSaveStorage,
	type DeleteActiveGameSaveProps,
	type GameSaveStorageRecord,
	type GameSaveStorageScope,
	type SaveActiveGameSaveProps,
} from "~/v0/game/storage/GameSaveStorage";

export const defaultDexieGameSaveDatabaseName = "arkini-v0-game-storage";

class DexieGameSaveDatabase extends Dexie {
	saves!: Table<GameSaveStorageRecord, string>;

	constructor(databaseName: string) {
		super(databaseName);
		this.version(1).stores({
			saves: "&id, gameId, configHash, updatedAtMs",
		});
	}
}

export namespace DexieGameSaveStorage {
	export interface Options {
		databaseName?: string;
	}
}

const readSaveId = (saveId: string | undefined) => saveId ?? activeGameSaveId;

export class DexieGameSaveStorage implements CloseableGameSaveStorage {
	private database: DexieGameSaveDatabase;
	private readonly databaseName: string;

	constructor({
		databaseName = defaultDexieGameSaveDatabaseName,
	}: DexieGameSaveStorage.Options = {}) {
		this.databaseName = databaseName;
		this.database = new DexieGameSaveDatabase(databaseName);
	}

	async loadActiveSave({
		configHash,
		gameId,
		saveId,
	}: GameSaveStorageScope): Promise<GameSave | null> {
		const record = await this.database.saves.get(readSaveId(saveId));
		if (!record) return null;
		if (record.schemaVersion !== gameSaveStorageSchemaVersion) return null;
		if (record.gameId !== gameId) return null;
		if (record.configHash !== configHash) return null;
		if (record.saveVersion !== 1) return null;

		const parsed = GameSaveSchema.safeParse(record.save);
		if (!parsed.success) return null;
		if (parsed.data.gameId !== gameId) return null;

		return parsed.data;
	}

	async saveActiveSave({ configHash, save, saveId }: SaveActiveGameSaveProps) {
		const parsed = GameSaveSchema.parse(save);
		await this.database.saves.put({
			id: readSaveId(saveId),
			configHash,
			gameId: parsed.gameId,
			save: parsed,
			saveVersion: parsed.version,
			schemaVersion: gameSaveStorageSchemaVersion,
			updatedAtMs: parsed.updatedAtMs,
		});
	}

	async deleteActiveSave({ saveId }: DeleteActiveGameSaveProps = {}) {
		await this.database.saves.delete(readSaveId(saveId));
	}

	async wipe() {
		await this.database.delete();
		this.database = new DexieGameSaveDatabase(this.databaseName);
	}

	close() {
		this.database.close();
	}
}

export const createDefaultDexieGameSaveStorage = () => new DexieGameSaveStorage();

export const wipeDefaultDexieGameSaveStorage = async () => {
	const storage = createDefaultDexieGameSaveStorage();
	try {
		await storage.wipe();
	} finally {
		storage.close();
	}
};
