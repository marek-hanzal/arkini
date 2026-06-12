import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "./save";
import type { GameSaveView } from "./playTypes";

export async function readGameSaveView(): Promise<GameSaveView> {
	const save = await db
		.selectFrom(table.saveGame)
		.select([
			"id",
			"boardWidth",
			"boardHeight",
			"inventorySlots",
		])
		.where("id", "=", defaultSaveGameId)
		.executeTakeFirstOrThrow();

	return save;
}
