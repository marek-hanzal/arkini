export { bootstrapDatabase, hardResetDatabaseFile, readDatabasePath, readGameDataHash, readMigrationState } from "./bootstrap";
export { kysely, sqlite } from "./client";
export type { Database } from "./schema";
export { readDatabaseStatus, type DatabaseStatus } from "./status";
export { syncGameDataManifest } from "./syncGameData";

export {
  advanceAutoProducers,
  buildRecipe,
  mergeBoardItems,
  moveBoardItem,
  placeInventoryItem,
  produceBoardItem,
  stashBoardItem,
  swapInventorySlots,
  toggleProducerPause,
} from "./gameplay";

export { readGameView } from "./gameView";
export type { AutoProducerResult, BoardViewItem, GameView, InventorySlot, ProducerDropResult, ViewItem } from "./gameplayTypes";
