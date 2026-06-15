import type { BrowserDatabaseService } from "~/v0/database/context/BrowserDatabaseServiceFx";
import { assertBrowserDatabaseSupport } from "~/v0/database/local/capabilities";
import { databasePath } from "~/v0/database/local/client";
import { migrator } from "~/v0/database/local/migrator";

export const BrowserDatabaseServiceLive: BrowserDatabaseService = {
	databasePath,
	assertSupported: assertBrowserDatabaseSupport,
	migrateToLatest() {
		return migrator.migrateToLatest();
	},
};
