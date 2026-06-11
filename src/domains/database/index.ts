export { bootstrapDatabase, hardResetDatabaseFile, readDatabasePath, readGameDataHash, readMigrationState } from "./bootstrap";
export { kysely, sqlite } from "./client";
export type { Database } from "./schema";
export { readDatabaseStatus, type DatabaseStatus } from "./status";
export { syncGameDataManifest } from "./syncGameData";

export {
  buildRecipe,
  mergeBoardItems,
  moveBoardItem,
  placeInventoryItem,
  produceBoardItem,
  readGameView,
  resetDefaultSaveGame,
  stashBoardItem,
  swapInventorySlots,
  type GameView,
  type ProducerDropResult,
} from "./gameplay";
