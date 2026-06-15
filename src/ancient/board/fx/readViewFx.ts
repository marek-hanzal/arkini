import { Effect } from "effect";
import { readActivationInputRowsFx } from "~/activation/fx/readActivationInputRowsFx";
import { groupActivationInputRows } from "~/activation/logic/groupActivationInputRows";
import { findFirstEmptyCell } from "~/board/logic/findFirstEmptyCell";
import { readActivationView } from "~/board/logic/readActivationView";
import { readBoardState } from "~/board/logic/readBoardState";
import { readCraftView } from "~/board/logic/readCraftView";
import { cellKey } from "~/board/util/cell";
import type { BoardItemState } from "~/board/view/BoardItemStateSchema";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { BoardViewSchema, type BoardView } from "~/board/view/BoardViewSchema";
import { readCraftInputRowsFx } from "~/craft/fx/readCraftInputRowsFx";
import { groupCraftInputRows } from "~/craft/logic/groupCraftInputRows";
import { dbFx } from "~/database/fx/dbFx";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { readBoardItemRowsFx } from "~/item-instance/fx/readBoardItemRowsFx";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import type { ItemId } from "~/manifest/manifestId";
import { defaultSaveGameId } from "~/play/logic/save";
import { parseJson } from "~/shared/parseJson";

export const readViewFx = Effect.fn("readViewFx")(function* () {
	const date = yield* DateServiceFx;
	const gameConfig = yield* GameConfigServiceFx;
	const rows = yield* readBoardItemRowsFx();

	const [upgradeRows, activationInputRows, craftInputRows] = yield* Effect.all([
		dbFx((db) =>
			db
				.selectFrom("playerUpgrade")
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
		const state = parseJson<BoardItemState>(item.stateJson || "{}");
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
