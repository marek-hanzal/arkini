import { Effect } from "effect";
import { db } from "~/database/local/db";
import type { Database } from "~/database/local/schema";
import { table } from "~/database/local/tables";
import { GameConfig } from "~/manifest/data/GameConfig";
import { readDatabasePathFx } from "./readDatabasePathFx";
import { readGameConfigHashFx } from "./readGameConfigHashFx";
import { readMigrationStateFx } from "./readMigrationStateFx";
import { tryGameActionFx } from "./tryGameActionFx";

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

export const readStatusFx = Effect.fn("readStatusFx")(function* () {
	const counts = yield* tryGameActionFx(() =>
		Promise.all(
			Object.entries(saveTables).map(
				async ([key, name]) =>
					[
						key,
						await count(name),
					] as const,
			),
		),
	);

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
		...Object.fromEntries(counts),
	} as DatabaseStatus;
});

type CountableTable = (typeof saveTables)[keyof typeof saveTables];

async function count(tableName: CountableTable) {
	const row = await db
		.selectFrom(tableName as keyof Database)
		.select((eb) => eb.fn.countAll<number>().as("count"))
		.executeTakeFirstOrThrow();

	return Number(row.count);
}
