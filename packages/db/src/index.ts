export { bootstrapDatabase, readDatabasePath, readGameDataHash, readMigrationState } from "./bootstrap";
export { kysely, sqlite } from "./client";
export type { Database } from "./schema";
export { readDatabaseStatus, type DatabaseStatus } from "./status";
export { syncGameDataManifest } from "./syncGameData";

export {
  buildRecipe,
  mergeBoardItems,
  placeInventoryItem,
  produceBoardItem,
  readGameView,
  resetDefaultSaveGame,
  stashBoardItem,
  type GameView,
} from "./gameplay";
