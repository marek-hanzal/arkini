import { Context } from "effect";
import type { migrator } from "~/database/local/migrator";

export interface BrowserDatabaseService {
	databasePath: string;
	assertSupported(): void;
	migrateToLatest(): ReturnType<typeof migrator.migrateToLatest>;
}

export class BrowserDatabaseServiceFx extends Context.Tag("BrowserDatabaseServiceFx")<
	BrowserDatabaseServiceFx,
	BrowserDatabaseService
>() {
	//
}
