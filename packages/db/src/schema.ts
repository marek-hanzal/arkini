import type { ColumnType } from "kysely";

export type Timestamp = ColumnType<string, string | undefined, string>;
export type Enabled = 0 | 1;

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
  sort: number;
  isEnabled: Enabled;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ItemDefinitionTable {
  id: string;
  assetId: string;
  code: string;
  name: string;
  tier: number;
  maxStackSize: number;
  description: string;
  tagsJson: string;
  sort: number;
  isEnabled: Enabled;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MergeDefinitionTable {
  id: string;
  inputItemId: string;
  inputCount: number;
  outputItemId: string;
  isEnabled: Enabled;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DropTableDefinitionTable {
  id: string;
  label: string;
  isEnabled: Enabled;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DropTableEntryTable {
  id: string;
  dropTableId: string;
  itemDefinitionId: string | null;
  weight: number;
  quantityJson: string | null;
  sort: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProducerDefinitionTable {
  itemDefinitionId: string;
  cooldownMs: number;
  modeJson: string;
  spawnJson: string;
  rollsJson: string;
  isEnabled: Enabled;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BuildRecipeDefinitionTable {
  id: string;
  blueprintItemId: string;
  resultItemId: string;
  costsJson: string;
  isEnabled: Enabled;
  createdAt: Timestamp;
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
  assetDefinition: AssetDefinitionTable;
  itemDefinition: ItemDefinitionTable;
  mergeDefinition: MergeDefinitionTable;
  dropTableDefinition: DropTableDefinitionTable;
  dropTableEntry: DropTableEntryTable;
  producerDefinition: ProducerDefinitionTable;
  buildRecipeDefinition: BuildRecipeDefinitionTable;
  saveGame: SaveGameTable;
  boardItem: BoardItemTable;
  inventoryStack: InventoryStackTable;
}
