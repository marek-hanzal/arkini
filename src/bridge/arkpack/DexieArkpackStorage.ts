import Dexie, { type Table } from "dexie";

import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import type { StoredArkpackRecord } from "~/bridge/arkpack/Arkpack";

const databaseName = "arkini-arkpacks";

class ArkpackDatabase extends Dexie {
	arkpacks!: Table<StoredArkpackRecord, string>;

	constructor(name: string) {
		super(name);
		this.version(1).stores({
			arkpacks: "&packageId, gameId, title, importedAtMs",
		});
	}
}

/** IndexedDB-backed storage for validated imported arkpack binaries. */
export class DexieArkpackStorage implements ArkpackStorage {
	readonly #database: ArkpackDatabase;

	constructor(name = databaseName) {
		this.#database = new ArkpackDatabase(name);
	}

	close = () => this.#database.close();
	list = () => this.#database.arkpacks.orderBy("importedAtMs").reverse().toArray();
	read = (packageId: string) => this.#database.arkpacks.get(packageId);
	remove = (packageId: string) => this.#database.arkpacks.delete(packageId);
	write = (record: StoredArkpackRecord) =>
		this.#database.arkpacks.put(record).then(() => undefined);
}
