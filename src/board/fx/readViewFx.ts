import { Effect } from "effect";
import { readActivationView, readCraftView } from "~/board/logic/boardState";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { cellKey } from "~/board/util/cell";
import { dbFx } from "~/database/fx/dbFx";
import { findFirstEmptyCell } from "~/board/logic/findFirstEmptyCell";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "~/play/logic/save";
import type { BoardItemState, BoardView, BoardViewItem } from "~/play/logic/playTypes";
import { json, parseJson } from "~/shared/json";

export const readViewFx = Effect.fn("readViewFx")(function* () {
	const date = yield* DateServiceFx;
	const gameConfig = yield* GameConfigServiceFx;
	const [rows, upgradeRows] = yield* dbFx((db) =>
		Promise.all([
			db
				.selectFrom(table.boardItem)
				.selectAll()
				.where("saveGameId", "=", defaultSaveGameId)
				.orderBy("y")
				.orderBy("x")
				.execute(),
			db
				.selectFrom(table.playerUpgrade)
				.selectAll()
				.where("saveGameId", "=", defaultSaveGameId)
				.execute(),
		]),
	);

	const items = rows.map((item): BoardViewItem => {
		const state = parseJson<BoardItemState>(item.stateJson || json({}));
		return {
			id: item.id,
			itemId: item.itemDefinitionId,
			x: item.x,
			y: item.y,
			state,
			activation: readActivationView({
				itemId: item.itemDefinitionId,
				state,
				date,
				gameConfig,
				upgradeRows,
			}),
			craft: readCraftView({
				itemId: item.itemDefinitionId,
				state,
				gameConfig,
			}),
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
