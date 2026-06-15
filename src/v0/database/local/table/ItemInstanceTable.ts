import type { Timestamp } from "~/v0/database/local/table/Timestamp";

export interface ItemInstanceTable {
	id: string;
	saveGameId: string;
	itemDefinitionId: string;
	quantity: number;
	locationKind: string;
	boardX: number | null;
	boardY: number | null;
	inventorySlotIndex: number | null;
	ownerItemInstanceId: string | null;
	inputItemDefinitionId: string | null;
	stateJson: string;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}
