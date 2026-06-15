import { Effect } from "effect";
import { createInitialBoardState } from "~/board/logic/createInitialBoardState";
import { dbFx } from "~/v0/database/fx/dbFx";
import { IdServiceFx } from "~/id/context/IdServiceFx";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { defaultSaveGameId } from "~/v0/play/save";
import { json } from "~/shared/json";

export namespace insertBoardItemFx {
	export interface Props {
		itemId: string;
		x: number;
		y: number;
		stateJson?: string;
	}
}

export const insertBoardItemFx = Effect.fn("insertBoardItemFx")(function* ({
	itemId,
	x,
	y,
	stateJson,
}: insertBoardItemFx.Props) {
	const gameConfig = yield* GameConfigServiceFx;
	const id = yield* IdServiceFx;
	const boardItemId = id.boardItem();
	yield* dbFx((db) =>
		db
			.insertInto("itemInstance")
			.values({
				id: boardItemId,
				saveGameId: defaultSaveGameId,
				itemDefinitionId: itemId,
				quantity: 1,
				locationKind: "board",
				boardX: x,
				boardY: y,
				inventorySlotIndex: null,
				ownerItemInstanceId: null,
				inputItemDefinitionId: null,
				stateJson: stateJson ?? json(createInitialBoardState(itemId, gameConfig)),
			})
			.execute(),
	);
	return boardItemId;
});
