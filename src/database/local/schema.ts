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

export interface PlayerUpgradeTable {
	id: string;
	saveGameId: string;
	upgradeDefinitionId: string;
	level: number;
	targetLevel: number | null;
	startedAt: string | null;
	readyAt: string | null;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}

export interface Database {
	metadata: MetadataTable;
	saveGame: SaveGameTable;
	itemInstance: ItemInstanceTable;
	playerUpgrade: PlayerUpgradeTable;
}
