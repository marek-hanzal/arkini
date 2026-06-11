import { kysely } from "./client";
import { readDatabasePath, readGameDataHash, readMigrationState } from "./bootstrap";

export interface DatabaseStatus {
  databasePath: string;
  migrationState: "pending" | "ready";
  gameDataHash: string;
  assetCount: number;
  itemCount: number;
  mergeCount: number;
  producerCount: number;
  buildRecipeCount: number;
  dropTableCount: number;
  saveGameCount: number;
}

export async function readDatabaseStatus(): Promise<DatabaseStatus> {
  const [asset, item, merge, producer, buildRecipe, dropTable, saveGame] = await Promise.all([
    count("assetDefinition"),
    count("itemDefinition"),
    count("mergeDefinition"),
    count("producerDefinition"),
    count("buildRecipeDefinition"),
    count("dropTableDefinition"),
    count("saveGame"),
  ]);

  return {
    databasePath: readDatabasePath(),
    migrationState: readMigrationState(),
    gameDataHash: readGameDataHash(),
    assetCount: asset,
    itemCount: item,
    mergeCount: merge,
    producerCount: producer,
    buildRecipeCount: buildRecipe,
    dropTableCount: dropTable,
    saveGameCount: saveGame,
  };
}

type CountableTable =
  | "assetDefinition"
  | "itemDefinition"
  | "mergeDefinition"
  | "producerDefinition"
  | "buildRecipeDefinition"
  | "dropTableDefinition"
  | "saveGame";

async function count(table: CountableTable) {
  const row = await kysely
    .selectFrom(table)
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .executeTakeFirstOrThrow();

  return Number(row.count);
}
