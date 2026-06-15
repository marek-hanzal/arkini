import type { Timestamp } from "~/database/local/table/Timestamp";

export interface SaveGameTable {
	id: string;
	name: string;
	boardWidth: number;
	boardHeight: number;
	inventorySlots: number;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}
