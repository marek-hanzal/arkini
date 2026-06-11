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
  stashBoardItem,
  swapInventorySlots,
} from "./gameplay";

export { readGameView } from "./gameView";
export type { GameView, ProducerDropResult } from "./gameplayTypes";
