import { Effect } from "effect";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import type { DatabaseStatus } from "~/v0/database/model/DatabaseStatus";
import { readSaveTableCountsFx } from "~/v0/database/fx/readSaveTableCountsFx";
import { readDatabasePathFx } from "~/v0/database/fx/readDatabasePathFx";
import { readGameConfigHashFx } from "~/v0/database/fx/readGameConfigHashFx";
import { readMigrationStateFx } from "~/v0/database/fx/readMigrationStateFx";

export const readDatabaseStatusFx = Effect.fn("readDatabaseStatusFx")(function* () {
	const gameConfig = yield* GameConfigServiceFx;

	return {
		databasePath: yield* readDatabasePathFx(),
		migrationState: yield* readMigrationStateFx(),
		gameConfigHash: yield* readGameConfigHashFx(),
		...gameConfig.summary(),
		...(yield* readSaveTableCountsFx()),
	} satisfies DatabaseStatus;
});
