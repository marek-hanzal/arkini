import type { StoredArkpackRecord } from "~/bridge/arkpack/Arkpack";

/** Durable storage contract for imported package binaries. */
export interface ArkpackStorage {
	readonly close: () => void;
	readonly list: () => Promise<ReadonlyArray<StoredArkpackRecord>>;
	readonly read: (packageId: string) => Promise<StoredArkpackRecord | undefined>;
	readonly remove: (packageId: string) => Promise<void>;
	readonly write: (record: StoredArkpackRecord) => Promise<void>;
}
