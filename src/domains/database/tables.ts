import type { Database } from "./schema";

export const table = {
  metadata: "metadata",
  assetDefinition: "assetDefinition",
  itemDefinition: "itemDefinition",
  mergeDefinition: "mergeDefinition",
  dropTableDefinition: "dropTableDefinition",
  dropTableEntry: "dropTableEntry",
  producerDefinition: "producerDefinition",
  buildRecipeDefinition: "buildRecipeDefinition",
  saveGame: "saveGame",
  boardItem: "boardItem",
  inventoryStack: "inventoryStack",
} as const satisfies { [Name in keyof Database]: Name };
