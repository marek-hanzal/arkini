import { boardColumns, boardRows } from "~/board/boardIdentity";
import { readProducerView } from "~/board/logic/boardState";
import { cellKey } from "~/board/util/cell";
import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { json, parseJson } from "~/shared/json";
import { defaultSaveGameId } from "./save";
import type { BoardItemState, BoardView, BoardViewItem } from "./playTypes";

export async function readBoardView(): Promise<BoardView> {
	const boardRowsResult = await db
		.selectFrom(table.boardItem)
		.selectAll()
		.where("saveGameId", "=", defaultSaveGameId)
		.orderBy("y")
		.orderBy("x")
		.execute();

	const items = boardRowsResult.map((item): BoardViewItem => {
		const state = parseJson<BoardItemState>(item.stateJson || json({}));
		return {
			id: item.id,
			itemId: item.itemDefinitionId,
			x: item.x,
			y: item.y,
			state,
			producer: readProducerView(item.itemDefinitionId, state),
		};
	});

	const byId = Object.fromEntries(
		items.map((item) => [
			item.id,
			item,
		]),
	);
	const byCellKey = Object.fromEntries(
		items.map((item) => [
			cellKey(item.x, item.y),
			item,
		]),
	);

	return {
		items,
		byId,
		byCellKey,
		firstEmptyCell: findFirstEmptyBoardCell(byCellKey),
	};
}

function findFirstEmptyBoardCell(byCellKey: BoardView["byCellKey"]): BoardView["firstEmptyCell"] {
	for (let y = 0; y < boardRows; y++) {
		for (let x = 0; x < boardColumns; x++) {
			if (!byCellKey[cellKey(x, y)])
				return {
					x,
					y,
				};
		}
	}

	return undefined;
}
