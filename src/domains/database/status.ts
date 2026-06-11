import { readDatabasePath, readGameDataHash, readMigrationState } from "./bootstrap";
import { db } from "./db";
import type { Database } from "./schema";
import { table } from "./tables";

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

const statusTables = {
  assetCount: table.assetDefinition,
  itemCount: table.itemDefinition,
  mergeCount: table.mergeDefinition,
  producerCount: table.producerDefinition,
  buildRecipeCount: table.buildRecipeDefinition,
  dropTableCount: table.dropTableDefinition,
  saveGameCount: table.saveGame,
} as const;

export async function readDatabaseStatus(): Promise<DatabaseStatus> {
  const counts = await Promise.all(Object.entries(statusTables).map(async ([key, name]) => [key, await count(name)] as const));

  return {
    databasePath: readDatabasePath(),
    migrationState: readMigrationState(),
    gameDataHash: readGameDataHash(),
    ...Object.fromEntries(counts),
  } as DatabaseStatus;
}

type CountableTable = (typeof statusTables)[keyof typeof statusTables];

async function count(tableName: CountableTable) {
  const row = await db
    .selectFrom(tableName as keyof Database)
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .executeTakeFirstOrThrow();

  return Number(row.count);
}
