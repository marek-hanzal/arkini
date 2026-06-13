import { Effect } from "effect";
import type { ArkiniTransaction } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "~/play/logic/save";
import {
	BoardItemRowSchema,
	InventoryStackRowSchema,
	SaveRowSchema,
} from "~/play/logic/gameActionSchemas";
import { tryGameActionFx } from "./tryGameActionFx";

export namespace readMutableSaveFx {
	export interface Props {
		tx: ArkiniTransaction;
	}
}

export const readMutableSaveFx = Effect.fn("readMutableSaveFx")(function* ({
	tx,
}: readMutableSaveFx.Props) {
	const [saveRow, boardRows, inventoryRows] = yield* tryGameActionFx(() =>
		Promise.all([
			tx
				.selectFrom(table.saveGame)
				.selectAll()
				.where("id", "=", defaultSaveGameId)
				.executeTakeFirstOrThrow(),
			tx
				.selectFrom(table.boardItem)
				.selectAll()
				.where("saveGameId", "=", defaultSaveGameId)
				.execute(),
			tx
				.selectFrom(table.inventoryStack)
				.selectAll()
				.where("saveGameId", "=", defaultSaveGameId)
				.orderBy("slotIndex")
				.execute(),
		]),
	);

	return {
		save: SaveRowSchema.parse(saveRow),
		boardRows: boardRows.map((row) => BoardItemRowSchema.parse(row)),
		inventoryRows: inventoryRows.map((row) => InventoryStackRowSchema.parse(row)),
	};
});
