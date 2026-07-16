import Dexie, { type Table } from "dexie";

import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import { StateSchema } from "~/engine/state/schema/StateSchema";

interface GameSaveRecord {
	readonly packageId: string;
	readonly contentHash: string;
	readonly documentVersion: 1;
	readonly state: unknown;
	readonly updatedAtMs: number;
}

const databaseName = "arkini-game-saves";

class GameSaveDatabase extends Dexie {
	saves!: Table<GameSaveRecord, string>;

	constructor(name: string) {
		super(name);
		this.version(1).stores({
			saves: "&packageId, contentHash, updatedAtMs",
		});
	}
}

/** IndexedDB-backed save storage namespaced by exact package identity. */
export class DexieGameSaveStorage implements GameSaveStorage {
	readonly #database: GameSaveDatabase;

	constructor(name = databaseName) {
		this.#database = new GameSaveDatabase(name);
	}

	close = () => this.#database.close();
	remove = (packageId: string) => this.#database.saves.delete(packageId);

	read = async ({ packageId, contentHash }: GameSaveStorage.Scope) => {
		const record = await this.#database.saves.get(packageId);
		if (record === undefined) return null;
		if (record.documentVersion !== 1 || record.contentHash !== contentHash) {
			await this.#database.saves.delete(packageId);
			return null;
		}
		const parsed = StateSchema.safeParse(record.state);
		if (!parsed.success) {
			await this.#database.saves.delete(packageId);
			return null;
		}
		return parsed.data;
	};

	write = ({ packageId, contentHash, state }: GameSaveStorage.Write) =>
		this.#database.saves
			.put({
				packageId,
				contentHash,
				documentVersion: 1,
				state,
				updatedAtMs: Date.now(),
			})
			.then(() => undefined);
}
