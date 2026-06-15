import type { Timestamp } from "~/v0/database/local/table/Timestamp";

export interface SaveGameTable {
	id: string;
	name: string;
	boardWidth: number;
	boardHeight: number;
	inventorySlots: number;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}
