import type { ItemInstanceTable } from "~/database/local/table/ItemInstanceTable";
import type { MetadataTable } from "~/database/local/table/MetadataTable";
import type { PlayerUpgradeTable } from "~/database/local/table/PlayerUpgradeTable";
import type { SaveGameTable } from "~/database/local/table/SaveGameTable";

export type { Timestamp } from "~/database/local/table/Timestamp";
export type { ItemInstanceTable } from "~/database/local/table/ItemInstanceTable";
export type { MetadataTable } from "~/database/local/table/MetadataTable";
export type { PlayerUpgradeTable } from "~/database/local/table/PlayerUpgradeTable";
export type { SaveGameTable } from "~/database/local/table/SaveGameTable";

export interface Database {
	metadata: MetadataTable;
	saveGame: SaveGameTable;
	itemInstance: ItemInstanceTable;
	playerUpgrade: PlayerUpgradeTable;
}
