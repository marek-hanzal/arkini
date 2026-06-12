import { gameDataManifest } from "~/manifest/server";
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
  boardItemCount: number;
  inventoryStackCount: number;
}

const saveTables = {
  saveGameCount: table.saveGame,
  boardItemCount: table.boardItem,
  inventoryStackCount: table.inventoryStack,
} as const;

export async function readDatabaseStatus(): Promise<DatabaseStatus> {
  const counts = await Promise.all(Object.entries(saveTables).map(async ([key, name]) => [key, await count(name)] as const));

  return {
    databasePath: readDatabasePath(),
    migrationState: readMigrationState(),
    gameDataHash: readGameDataHash(),
    assetCount: gameDataManifest.assets.length,
    itemCount: gameDataManifest.items.length,
    mergeCount: gameDataManifest.items.reduce((sum, item) => sum + (item.merge?.length ?? 0), 0),
    producerCount: gameDataManifest.items.filter((item) => item.producer).length,
    buildRecipeCount: gameDataManifest.items.filter((item) => item.build).length,
    dropTableCount: 0,
    ...Object.fromEntries(counts),
  } as DatabaseStatus;
}

type CountableTable = (typeof saveTables)[keyof typeof saveTables];

async function count(tableName: CountableTable) {
  const row = await db
    .selectFrom(tableName as keyof Database)
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .executeTakeFirstOrThrow();

  return Number(row.count);
}
