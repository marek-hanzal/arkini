import { Effect } from "effect";
import { createInitialBoardState } from "~/board/logic/boardState";
import { createBoardItemId } from "~/board/logic/createBoardItemId";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "~/play/logic/save";
import { json } from "~/shared/json";

export namespace insertFx {
	export interface Props {
		itemId: string;
		x: number;
		y: number;
	}
}

export const insertFx = Effect.fn("insertFx")(function* ({ itemId, x, y }: insertFx.Props) {
	const id = createBoardItemId();
	yield* dbFx((db) =>
		db
			.insertInto(table.boardItem)
			.values({
				id,
				saveGameId: defaultSaveGameId,
				itemDefinitionId: itemId,
				x,
				y,
				stateJson: json(createInitialBoardState(itemId)),
			})
			.execute(),
	);
	return id;
});
