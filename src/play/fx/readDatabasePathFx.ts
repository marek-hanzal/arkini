import { Effect } from "effect";
import { databasePath } from "~/database/local/client";

export const readDatabasePathFx = Effect.fn("readDatabasePathFx")(function* () {
	return databasePath;
});
