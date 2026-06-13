import type { ColumnType } from "kysely";

export type Timestamp = ColumnType<string, string | undefined, string>;

export interface MetadataTable {
	key: string;
	value: string;
	updatedAt: Timestamp;
}

export interface SaveGameTable {
	id: string;
	name: string;
	boardWidth: number;
	boardHeight: number;
	inventorySlots: number;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}

export interface BoardItemTable {
	id: string;
	saveGameId: string;
	itemDefinitionId: string;
	x: number;
	y: number;
	stateJson: string;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}

export interface PlayerResourceTable {
	id: string;
	saveGameId: string;
	resourceDefinitionId: string;
	quantity: number;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}

export interface InventoryStackTable {
	id: string;
	saveGameId: string;
	slotIndex: number;
	itemDefinitionId: string;
	quantity: number;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}

export interface Database {
	metadata: MetadataTable;
	saveGame: SaveGameTable;
	boardItem: BoardItemTable;
	inventoryStack: InventoryStackTable;
	playerResource: PlayerResourceTable;
}
