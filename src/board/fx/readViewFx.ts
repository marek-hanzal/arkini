import { Effect } from "effect";
import { boardColumns, boardRows } from "~/board/boardIdentity";
import { readProducerView } from "~/board/logic/boardState";
import { cellKey } from "~/board/util/cell";
import { dbFx } from "~/database/fx/dbFx";
import { findFirstEmptyCell } from "~/board/logic/findFirstEmptyCell";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "~/play/logic/save";
import type { BoardItemState, BoardView, BoardViewItem } from "~/play/logic/playTypes";
import { json, parseJson } from "~/shared/json";

export const readViewFx = Effect.fn("readViewFx")(function* () {
	const rows = yield* dbFx((db) =>
		db
			.selectFrom(table.boardItem)
			.selectAll()
			.where("saveGameId", "=", defaultSaveGameId)
			.orderBy("y")
			.orderBy("x")
			.execute(),
	);

	const items = rows.map((item): BoardViewItem => {
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
		firstEmptyCell: findFirstEmptyCell(byCellKey),
	} satisfies BoardView;
});
