import { kysely } from "./client";
import { readDatabasePath, readMigrationState } from "./bootstrap";

export interface DatabaseStatus {
  databasePath: string;
  migrationState: "pending" | "ready";
  assetCount: number;
  itemCount: number;
  recipeCount: number;
  saveGameCount: number;
}

export async function readDatabaseStatus(): Promise<DatabaseStatus> {
  const [asset, item, recipe, saveGame] = await Promise.all([
    kysely.selectFrom("assetDefinition").select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow(),
    kysely.selectFrom("itemDefinition").select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow(),
    kysely.selectFrom("mergeRecipe").select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow(),
    kysely.selectFrom("saveGame").select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow(),
  ]);

  return {
    databasePath: readDatabasePath(),
    migrationState: readMigrationState(),
    assetCount: Number(asset.count),
    itemCount: Number(item.count),
    recipeCount: Number(recipe.count),
    saveGameCount: Number(saveGame.count),
  };
}
