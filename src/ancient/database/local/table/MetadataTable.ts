import type { Timestamp } from "~/database/local/table/Timestamp";

export interface MetadataTable {
	key: string;
	value: string;
	updatedAt: Timestamp;
}
