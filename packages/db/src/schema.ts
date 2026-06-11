import type { ColumnType, Generated } from "kysely";

export type Timestamp = ColumnType<string, string | undefined, string>;

export interface MetadataTable {
  key: string;
  value: string;
  updatedAt: Timestamp;
}

export interface AssetDefinitionTable {
  id: string;
  kind: "item" | "ui";
  label: string;
  src: string;
  createdAt: Timestamp;
}

export interface ItemDefinitionTable {
  id: string;
  assetId: string;
  code: string;
  name: string;
  tier: number;
  description: string | null;
  sort: number;
  createdAt: Timestamp;
}

export interface MergeRecipeTable {
  id: string;
  inputItemId: string;
  outputItemId: string;
  inputCount: number;
  createdAt: Timestamp;
}

export interface SaveGameTable {
  id: string;
  name: string;
  boardWidth: number;
  boardHeight: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BoardSlotTable {
  id: Generated<number>;
  saveGameId: string;
  x: number;
  y: number;
  itemDefinitionId: string | null;
  stack: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Database {
  metadata: MetadataTable;
  assetDefinition: AssetDefinitionTable;
  itemDefinition: ItemDefinitionTable;
  mergeRecipe: MergeRecipeTable;
  saveGame: SaveGameTable;
  boardSlot: BoardSlotTable;
}
