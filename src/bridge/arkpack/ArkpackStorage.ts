import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";

export namespace ArkpackStorage {
	export interface LoadedRecord {
		readonly descriptor: ArkpackDescriptor;
		readonly bytes: ArrayBuffer;
	}
}

/** Durable storage contract with metadata-only listing and exact binary reads. */
export interface ArkpackStorage {
	readonly close: () => void;
	readonly list: () => Promise<ReadonlyArray<ArkpackDescriptor>>;
	readonly read: (packageId: string) => Promise<ArkpackStorage.LoadedRecord | undefined>;
	readonly remove: (packageId: string) => Promise<void>;
	readonly write: (descriptor: ArkpackDescriptor, bytes: ArrayBuffer) => Promise<void>;
}
