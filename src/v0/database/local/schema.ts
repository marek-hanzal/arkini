import type { ItemInstanceTable } from "~/v0/database/local/table/ItemInstanceTable";
import type { MetadataTable } from "~/v0/database/local/table/MetadataTable";
import type { PlayerUpgradeTable } from "~/v0/database/local/table/PlayerUpgradeTable";
import type { SaveGameTable } from "~/v0/database/local/table/SaveGameTable";

export type { Timestamp } from "~/v0/database/local/table/Timestamp";
export type { ItemInstanceTable } from "~/v0/database/local/table/ItemInstanceTable";
export type { MetadataTable } from "~/v0/database/local/table/MetadataTable";
export type { PlayerUpgradeTable } from "~/v0/database/local/table/PlayerUpgradeTable";
export type { SaveGameTable } from "~/v0/database/local/table/SaveGameTable";

export interface Database {
	metadata: MetadataTable;
	saveGame: SaveGameTable;
	itemInstance: ItemInstanceTable;
	playerUpgrade: PlayerUpgradeTable;
}
