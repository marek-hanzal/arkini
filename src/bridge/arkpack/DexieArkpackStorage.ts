import Dexie, { type Table } from "dexie";

import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";

interface ArkpackPayloadRecord {
	readonly packageId: string;
	readonly bytes: ArrayBuffer;
}

interface LegacyStoredArkpackRecord extends Omit<ArkpackDescriptor, "compressedSize"> {
	readonly bytes: ArrayBuffer;
}

const databaseName = "arkini-arkpacks";

class ArkpackDatabase extends Dexie {
	arkpacks!: Table<ArkpackDescriptor, string>;
	payloads!: Table<ArkpackPayloadRecord, string>;

	constructor(name: string) {
		super(name);
		this.version(1).stores({
			arkpacks: "&packageId, gameId, title, importedAtMs",
		});
		this.version(2)
			.stores({
				arkpacks: "&packageId, gameId, title, importedAtMs",
				payloads: "&packageId",
			})
			.upgrade(async (transaction) => {
				const legacyTable = transaction.table<LegacyStoredArkpackRecord>("arkpacks");
				const legacy = await legacyTable.toArray();
				if (legacy.length === 0) return;

				await transaction.table<ArkpackPayloadRecord>("payloads").bulkPut(
					legacy.map(({ packageId, bytes }) => ({
						packageId,
						bytes,
					})),
				);
				await transaction.table<ArkpackDescriptor>("arkpacks").bulkPut(
					legacy.map(({ bytes, ...descriptor }) => ({
						...descriptor,
						compressedSize: bytes.byteLength,
					})),
				);
			});
	}
}

/** IndexedDB-backed storage with payload-free catalog reads and atomic exact-package writes. */
export class DexieArkpackStorage implements ArkpackStorage {
	readonly #database: ArkpackDatabase;

	constructor(name = databaseName) {
		this.#database = new ArkpackDatabase(name);
	}

	close = () => this.#database.close();
	list = async () => {
		const descriptors = await this.#database.arkpacks.toArray();
		return descriptors.sort(
			(left, right) =>
				(right.importedAtMs ?? 0) - (left.importedAtMs ?? 0) ||
				left.packageId.localeCompare(right.packageId),
		);
	};

	read = (packageId: string) =>
		this.#database.transaction(
			"r",
			this.#database.arkpacks,
			this.#database.payloads,
			async () => {
				const [descriptor, payload] = await Promise.all([
					this.#database.arkpacks.get(packageId),
					this.#database.payloads.get(packageId),
				]);
				if (descriptor === undefined && payload === undefined) return undefined;
				if (descriptor === undefined || payload === undefined) {
					throw new Error(`Arkpack ${packageId} storage is incomplete.`);
				}
				return {
					descriptor,
					bytes: payload.bytes,
				};
			},
		);

	remove = (packageId: string) =>
		this.#database
			.transaction("rw", this.#database.arkpacks, this.#database.payloads, async () => {
				await Promise.all([
					this.#database.arkpacks.delete(packageId),
					this.#database.payloads.delete(packageId),
				]);
			})
			.then(() => undefined);

	write = (descriptor: ArkpackDescriptor, bytes: ArrayBuffer) => {
		if (descriptor.compressedSize !== bytes.byteLength) {
			return Promise.reject(
				new Error(
					`Arkpack ${descriptor.packageId} metadata size does not match its binary payload.`,
				),
			);
		}
		return this.#database
			.transaction("rw", this.#database.arkpacks, this.#database.payloads, async () => {
				await this.#database.arkpacks.put(descriptor);
				await this.#database.payloads.put({
					packageId: descriptor.packageId,
					bytes,
				});
			})
			.then(() => undefined);
	};
}
