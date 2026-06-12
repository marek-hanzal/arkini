import { GameConfig } from "~/manifest/data/GameConfig";
import { readDatabasePath, readGameConfigHash, readMigrationState } from "./bootstrap";
import { db } from "~/database/local/db";
import type { Database } from "~/database/local/schema";
import { table } from "~/database/local/tables";

export interface DatabaseStatus {
	databasePath: string;
	migrationState: "pending" | "ready";
	gameConfigHash: string;
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
	const counts = await Promise.all(
		Object.entries(saveTables).map(
			async ([key, name]) =>
				[
					key,
					await count(name),
				] as const,
		),
	);

	return {
		databasePath: readDatabasePath(),
		migrationState: readMigrationState(),
		gameConfigHash: readGameConfigHash(),
		assetCount: GameConfig.assets.length,
		itemCount: GameConfig.items.length,
		mergeCount: GameConfig.items.reduce((sum, item) => sum + (item.merge?.length ?? 0), 0),
		producerCount: GameConfig.items.filter((item) => item.producer).length,
		buildRecipeCount: GameConfig.items.filter((item) => item.build).length,
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
