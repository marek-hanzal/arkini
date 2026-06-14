import { Effect } from "effect";
import {
	createInitialBoardState,
	readActivationView,
	readBoardState,
	readCraftView,
} from "~/board/logic/boardState";
import { findFirstEmptyCell } from "~/board/logic/findFirstEmptyCell";
import { cellKey } from "~/board/util/cell";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { defaultSaveGameId } from "~/play/logic/save";
import type { BoardItemState, BoardView, BoardViewItem } from "~/play/logic/playTypes";
import { json, parseJson } from "~/shared/json";

export const readViewFx = Effect.fn("readViewFx")(function* () {
	const date = yield* DateServiceFx;
	const gameConfig = yield* GameConfigServiceFx;
	const nowMs = date.nowMs();
	const updatedAt = date.timestamp();

	let rows = yield* dbFx((db) =>
		db
			.selectFrom(table.boardItem)
			.selectAll()
			.where("saveGameId", "=", defaultSaveGameId)
			.orderBy("y")
			.orderBy("x")
			.execute(),
	);

	const readyCraftRows = rows.flatMap((row) => {
		const recipe = gameConfig.getCraftRecipeForTarget(row.itemDefinitionId);
		if (!recipe) return [];
		const state = readBoardState(row);
		const readyAtMs = state.craft?.readyAt
			? date.parseTimestampMs(state.craft.readyAt)
			: undefined;
		if (readyAtMs === undefined || readyAtMs > nowMs) return [];
		return [
			{
				row,
				recipe,
			},
		];
	});

	if (readyCraftRows.length > 0) {
		yield* dbFx(async (db) => {
			for (const { row, recipe } of readyCraftRows) {
				await db
					.updateTable(table.boardItem)
					.set({
						itemDefinitionId: recipe.resultItemId,
						stateJson: json(createInitialBoardState(recipe.resultItemId, gameConfig)),
						updatedAt,
					})
					.where("id", "=", row.id)
					.execute();
			}
		});

		rows = yield* dbFx((db) =>
			db
				.selectFrom(table.boardItem)
				.selectAll()
				.where("saveGameId", "=", defaultSaveGameId)
				.orderBy("y")
				.orderBy("x")
				.execute(),
		);
	}

	const upgradeRows = yield* dbFx((db) =>
		db
			.selectFrom(table.playerUpgrade)
			.selectAll()
			.where("saveGameId", "=", defaultSaveGameId)
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
				date,
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
