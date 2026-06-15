import { Effect } from "effect";
import { BrowserDatabaseServiceFx } from "~/database/context/BrowserDatabaseServiceFx";

export const readDatabasePathFx = Effect.fn("readDatabasePathFx")(function* () {
	const browserDatabase = yield* BrowserDatabaseServiceFx;
	return browserDatabase.databasePath;
});
