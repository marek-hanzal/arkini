import { Effect } from "effect";
import { readActivationInputRowsFx } from "~/activation/fx/readActivationInputRowsFx";
import { groupActivationInputRows } from "~/activation/logic/groupActivationInputRows";
import { createInitialBoardState } from "~/board/logic/createInitialBoardState";
import { findFirstEmptyCell } from "~/board/logic/findFirstEmptyCell";
import { readActivationView } from "~/board/logic/readActivationView";
import { readBoardState } from "~/board/logic/readBoardState";
import { readCraftView } from "~/board/logic/readCraftView";
import { cellKey } from "~/board/util/cell";
import type { BoardItemState } from "~/board/view/BoardItemStateSchema";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { BoardViewSchema, type BoardView } from "~/board/view/BoardViewSchema";
import { deleteCraftInputsFx } from "~/craft/fx/deleteCraftInputsFx";
import { readCraftInputRowsFx } from "~/craft/fx/readCraftInputRowsFx";
import { groupCraftInputRows } from "~/craft/logic/groupCraftInputRows";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { readBoardItemRowsFx } from "~/item-instance/fx/readBoardItemRowsFx";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import type { ItemId } from "~/manifest/manifestId";
import { defaultSaveGameId } from "~/play/logic/save";
import { json } from "~/shared/json";
import { parseJson } from "~/shared/parseJson";

export const readViewFx = Effect.fn("readViewFx")(function* () {
	const date = yield* DateServiceFx;
	const gameConfig = yield* GameConfigServiceFx;
	const nowMs = date.nowMs();
	const updatedAt = date.timestamp();

	let rows = yield* readBoardItemRowsFx();

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
					.updateTable(table.itemInstance)
					.set({
						itemDefinitionId: recipe.resultItemId,
						stateJson: json(createInitialBoardState(recipe.resultItemId, gameConfig)),
						updatedAt,
					})
					.where("id", "=", row.id)
					.execute();
			}
		});
		for (const { row } of readyCraftRows) {
			yield* deleteCraftInputsFx({
				ownerItemInstanceId: row.id,
			});
		}

		rows = yield* readBoardItemRowsFx();
	}

	const [upgradeRows, activationInputRows, craftInputRows] = yield* Effect.all([
		dbFx((db) =>
			db
				.selectFrom(table.playerUpgrade)
				.selectAll()
				.where("saveGameId", "=", defaultSaveGameId)
				.execute(),
		),
		readActivationInputRowsFx({
			ownerItemInstanceIds: rows.map((row) => row.id),
		}),
		readCraftInputRowsFx({
			ownerItemInstanceIds: rows.map((row) => row.id),
		}),
	]);
	const activationInputsByOwner = groupActivationInputRows(activationInputRows);
	const craftInputsByOwner = groupCraftInputRows(craftInputRows);

	const items = rows.map((item): BoardViewItem => {
		const state = parseJson<BoardItemState>(item.stateJson || json({}));
		return {
			id: item.id,
			itemId: item.itemDefinitionId as ItemId,
			x: item.x,
			y: item.y,
			state,
			activation: readActivationView({
				itemId: item.itemDefinitionId as ItemId,
				state,
				date,
				gameConfig,
				upgradeRows,
				storedInputs: activationInputsByOwner.get(item.id),
			}),
			craft: readCraftView({
				itemId: item.itemDefinitionId as ItemId,
				state,
				date,
				gameConfig,
				storedInputs: craftInputsByOwner.get(item.id),
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

	return BoardViewSchema.parse({
		items,
		byId,
		byCellKey,
		firstEmptyCell: findFirstEmptyCell(byCellKey),
	}) satisfies BoardView;
});
