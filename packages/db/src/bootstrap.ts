import { databasePath } from "./client";
import { assertBrowserDatabaseSupport } from "./capabilities";
import { migrator } from "./migrator";
import { seedDatabase } from "./seed";

let bootstrapPromise: Promise<void> | undefined;
let migrationState: "pending" | "ready" = "pending";

export async function bootstrapDatabase() {
  assertBrowserDatabaseSupport();

  bootstrapPromise ??= (async () => {
    const result = await migrator.migrateToLatest();

    if (result.error) {
      throw result.error;
    }

    await seedDatabase();
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
