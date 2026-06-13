import { db } from "~/database/local/db";
import type { Database } from "~/database/local/schema";
import { table } from "~/database/local/tables";
import type { DatabaseStatus } from "~/play/logic/DatabaseStatus";

const saveTables = {
	saveGameCount: table.saveGame,
	boardItemCount: table.boardItem,
	inventoryStackCount: table.inventoryStack,
} as const;

type CountableTable = (typeof saveTables)[keyof typeof saveTables];

type SaveTableCounts = Pick<
	DatabaseStatus,
	"saveGameCount" | "boardItemCount" | "inventoryStackCount"
>;

export async function readSaveTableCounts(): Promise<SaveTableCounts> {
	return {
		saveGameCount: await count(saveTables.saveGameCount),
		boardItemCount: await count(saveTables.boardItemCount),
		inventoryStackCount: await count(saveTables.inventoryStackCount),
	};
}

async function count(tableName: CountableTable) {
	const row = await db
		.selectFrom(tableName as keyof Database)
		.select((eb) => eb.fn.countAll<number>().as("count"))
		.executeTakeFirstOrThrow();

	return Number(row.count);
}
