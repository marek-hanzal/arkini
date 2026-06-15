import type { Timestamp } from "~/v0/database/local/table/Timestamp";

export interface MetadataTable {
	key: string;
	value: string;
	updatedAt: Timestamp;
}
