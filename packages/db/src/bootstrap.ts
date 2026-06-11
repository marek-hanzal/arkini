import { databasePath } from "./client";
import { assertBrowserDatabaseSupport } from "./capabilities";
import { migrator } from "./migrator";
import { repairPrototypeSchemaDrift } from "./schemaCompatibility";
import { ensureDefaultSaveGame } from "./save";
import { syncGameDataManifest } from "./syncGameData";

let bootstrapPromise: Promise<void> | undefined;
let migrationState: "pending" | "ready" = "pending";
let gameDataHash = "pending";

export async function bootstrapDatabase() {
  assertBrowserDatabaseSupport();

  bootstrapPromise ??= (async () => {
    const result = await migrator.migrateToLatest();

    if (result.error) {
      throw result.error;
    }

    await repairPrototypeSchemaDrift();
    gameDataHash = await syncGameDataManifest();
    await ensureDefaultSaveGame();
    migrationState = "ready";
  })();

  return bootstrapPromise;
}

export function readMigrationState() {
  return migrationState;
}

export function readDatabasePath() {
  return databasePath;
}

export function readGameDataHash() {
  return gameDataHash;
}
