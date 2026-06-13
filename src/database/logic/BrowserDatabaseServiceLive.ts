import type { BrowserDatabaseService } from "~/database/context/BrowserDatabaseServiceFx";
import { assertBrowserDatabaseSupport } from "~/database/local/capabilities";
import { databasePath } from "~/database/local/client";
import { migrator } from "~/database/local/migrator";

export const BrowserDatabaseServiceLive: BrowserDatabaseService = {
	databasePath,
	assertSupported: assertBrowserDatabaseSupport,
	migrateToLatest() {
		return migrator.migrateToLatest();
	},
};
