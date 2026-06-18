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

const gameSaveDocumentVersion = 1;

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

const isRecoverableDexieSchemaError = (error: unknown) =>
	error instanceof Error &&
	[
		"VersionError",
		"UpgradeError",
	].includes(error.name);

export class DexieGameSaveStorage implements CloseableGameSaveStorage {
	private database: DexieGameSaveDatabase;
	private readonly databaseName: string;

	constructor({
		databaseName = defaultDexieGameSaveDatabaseName,
	}: DexieGameSaveStorage.Options = {}) {
		this.databaseName = databaseName;
		this.database = new DexieGameSaveDatabase(databaseName);
	}

	async loadActiveSave(scope: GameSaveStorageScope): Promise<GameSave | null> {
		return this.withSchemaRefresh(() => this.loadActiveSaveFromCurrentDatabase(scope));
	}

	async saveActiveSave({ configHash, save, saveId }: SaveActiveGameSaveProps) {
		const parsed = GameSaveSchema.parse(save);
		await this.withSchemaRefresh(() =>
			this.database.saves.put({
				id: readSaveId(saveId),
				configHash,
				gameId: parsed.gameId,
				save: parsed,
				saveVersion: parsed.version,
				schemaVersion: gameSaveStorageSchemaVersion,
				updatedAtMs: parsed.updatedAtMs,
			}),
		);
	}

	async deleteActiveSave({ saveId }: DeleteActiveGameSaveProps = {}) {
		await this.withSchemaRefresh(() => this.database.saves.delete(readSaveId(saveId)));
	}

	async wipe() {
		this.database.close();
		await Dexie.delete(this.databaseName);
		this.database = new DexieGameSaveDatabase(this.databaseName);
	}

	close() {
		this.database.close();
	}

	private async loadActiveSaveFromCurrentDatabase({
		configHash,
		gameId,
		saveId,
	}: GameSaveStorageScope) {
		const record = await this.database.saves.get(readSaveId(saveId));
		if (!record) return null;

		if (
			!this.isRecordCompatible(record, {
				configHash,
				gameId,
			})
		) {
			await this.wipe();
			return null;
		}

		const parsed = GameSaveSchema.safeParse(record.save);
		if (!parsed.success || parsed.data.gameId !== gameId) {
			await this.wipe();
			return null;
		}

		return parsed.data;
	}

	private isRecordCompatible(
		record: GameSaveStorageRecord,
		{
			configHash,
			gameId,
		}: {
			configHash: string;
			gameId: string;
		},
	) {
		return (
			record.schemaVersion === gameSaveStorageSchemaVersion &&
			record.saveVersion === gameSaveDocumentVersion &&
			record.gameId === gameId &&
			record.configHash === configHash
		);
	}

	private async withSchemaRefresh<T>(run: () => Promise<T>): Promise<T> {
		try {
			return await run();
		} catch (error) {
			if (!isRecoverableDexieSchemaError(error)) throw error;
			await this.wipe();
			return await run();
		}
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
