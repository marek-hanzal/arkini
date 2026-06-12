import { databasePath } from "~/database/local/client";
import { assertBrowserDatabaseSupport } from "~/database/local/capabilities";
import { migrator } from "~/database/local/migrator";
import { ensureDefaultSaveGame } from "./save";
import { syncGameConfig } from "./syncGameConfig";

let bootstrapPromise: Promise<void> | undefined;
let migrationState: "pending" | "ready" = "pending";
let gameConfigHash = "pending";

export async function bootstrapDatabase() {
  assertBrowserDatabaseSupport();

  bootstrapPromise ??= (async () => {
    const result = await migrator.migrateToLatest();

    if (result.error) {
      throw result.error;
    }

    const gameConfigSync = await syncGameConfig();
    gameConfigHash = gameConfigSync.hash;
    await ensureDefaultSaveGame({ resetExisting: gameConfigSync.changed });
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

export function readGameConfigHash() {
  return gameConfigHash;
}

// Development-only escape hatch: remove the OPFS SQLite file so the next page
// load starts from empty storage, runs every migration, then syncs the config.
// This project is still pre-release, so we deliberately avoid schema drift
// repair code and use a hard reset when local prototype data gets stale.
export async function hardResetDatabaseFile() {
  bootstrapPromise = undefined;
  migrationState = "pending";
  gameConfigHash = "pending";

  const { sqlite } = await import("~/database/local/client");
  await sqlite.deleteDatabaseFile(undefined, true);
}
