import { Effect } from "effect";
import { createInitialBoardState } from "~/board/logic/createInitialBoardState";
import { dbFx } from "~/database/fx/dbFx";
import { IdServiceFx } from "~/id/context/IdServiceFx";
import { table } from "~/database/local/tables";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { defaultSaveGameId } from "~/play/logic/save";
import { json } from "~/shared/json";

export namespace insertFx {
	export interface Props {
		itemId: string;
		x: number;
		y: number;
		stateJson?: string;
	}
}

export const insertFx = Effect.fn("insertFx")(function* ({
	itemId,
	x,
	y,
	stateJson,
}: insertFx.Props) {
	const gameConfig = yield* GameConfigServiceFx;
	const id = yield* IdServiceFx;
	const boardItemId = id.boardItem();
	yield* dbFx((db) =>
		db
			.insertInto(table.boardItem)
			.values({
				id: boardItemId,
				saveGameId: defaultSaveGameId,
				itemDefinitionId: itemId,
				x,
				y,
				stateJson: stateJson ?? json(createInitialBoardState(itemId, gameConfig)),
			})
			.execute(),
	);
	return boardItemId;
});
