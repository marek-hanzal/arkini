import { Effect } from "effect";
import { GameConfig } from "~/manifest/data/GameConfig";
import type { DatabaseStatus } from "~/play/logic/DatabaseStatus";
import { readSaveTableCountsFx } from "./readSaveTableCountsFx";
import { readDatabasePathFx } from "./readDatabasePathFx";
import { readGameConfigHashFx } from "./readGameConfigHashFx";
import { readMigrationStateFx } from "./readMigrationStateFx";

export const readStatusFx = Effect.fn("readStatusFx")(function* () {
	return {
		databasePath: yield* readDatabasePathFx(),
		migrationState: yield* readMigrationStateFx(),
		gameConfigHash: yield* readGameConfigHashFx(),
		assetCount: GameConfig.assets.length,
		itemCount: GameConfig.items.length,
		mergeCount: GameConfig.items.reduce((sum, item) => sum + (item.merge?.length ?? 0), 0),
		producerCount: GameConfig.items.filter((item) => item.producer).length,
		buildRecipeCount: GameConfig.items.filter((item) => item.build).length,
		dropTableCount: 0,
		...(yield* readSaveTableCountsFx()),
	} satisfies DatabaseStatus;
});
