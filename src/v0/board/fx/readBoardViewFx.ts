import { Effect } from "effect";
import { readActivationInputRowsFx } from "~/v0/activation/fx/readActivationInputRowsFx";
import { groupActivationInputRows } from "~/v0/activation/logic/groupActivationInputRows";
import { findFirstEmptyCell } from "~/v0/board/logic/findFirstEmptyCell";
import { readActivationView } from "~/v0/board/logic/readActivationView";
import { readBoardState } from "~/v0/board/logic/readBoardState";
import { readCraftView } from "~/v0/board/logic/readCraftView";
import { cellKey } from "~/v0/board/util/cell";
import type { BoardItemState } from "~/v0/board/view/BoardItemStateSchema";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { BoardViewSchema, type BoardView } from "~/v0/board/view/BoardViewSchema";
import { readCraftInputRowsFx } from "~/v0/craft/fx/readCraftInputRowsFx";
import { groupCraftInputRows } from "~/v0/craft/logic/groupCraftInputRows";
import { dbFx } from "~/v0/database/fx/dbFx";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import { readBoardItemRowsFx } from "~/v0/item-instance/fx/readBoardItemRowsFx";
import { GameConfigServiceFx } from "~/v0/game/context/GameConfigServiceFx";
import type { ItemId } from "~/v0/manifest/manifestId";
import { defaultSaveGameId } from "~/v0/play/save";
import { parseJson } from "~/v0/style/parseJson";

export const readBoardViewFx = Effect.fn("readBoardViewFx")(function* () {
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
