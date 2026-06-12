import { databasePath } from "~/database/local/client";
import { assertBrowserDatabaseSupport } from "~/database/local/capabilities";
import { migrator } from "~/database/local/migrator";
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

    const gameDataSync = await syncGameDataManifest();
    gameDataHash = gameDataSync.hash;
    await ensureDefaultSaveGame({ resetExisting: gameDataSync.changed });
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

// Development-only escape hatch: remove the OPFS SQLite file so the next page
// load starts from empty storage, runs every migration, then syncs the manifest.
// This project is still pre-release, so we deliberately avoid schema drift
// repair code and use a hard reset when local prototype data gets stale.
export async function hardResetDatabaseFile() {
  bootstrapPromise = undefined;
  migrationState = "pending";
  gameDataHash = "pending";

  const { sqlite } = await import("~/database/local/client");
  await sqlite.deleteDatabaseFile(undefined, true);
}
