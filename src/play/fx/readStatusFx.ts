import { Effect } from "effect";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import type { DatabaseStatus } from "~/play/logic/DatabaseStatus";
import { readSaveTableCountsFx } from "./readSaveTableCountsFx";
import { readDatabasePathFx } from "./readDatabasePathFx";
import { readGameConfigHashFx } from "./readGameConfigHashFx";
import { readMigrationStateFx } from "./readMigrationStateFx";

export const readStatusFx = Effect.fn("readStatusFx")(function* () {
	const gameConfig = yield* GameConfigServiceFx;

	return {
		databasePath: yield* readDatabasePathFx(),
		migrationState: yield* readMigrationStateFx(),
		gameConfigHash: yield* readGameConfigHashFx(),
		...gameConfig.summary(),
		...(yield* readSaveTableCountsFx()),
	} satisfies DatabaseStatus;
});
