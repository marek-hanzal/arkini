import { Effect } from "effect";
import { createInitialBoardState } from "~/board/logic/boardState";
import { createBoardItemId } from "~/board/logic/createBoardItemId";
import type { ArkiniTransaction } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { defaultSaveGameId } from "~/play/logic/save";
import { tryGameAction } from "~/play/logic/tryGameAction";
import { json } from "~/shared/json";

export namespace insertFx {
	export interface Props {
		tx: ArkiniTransaction;
		itemId: string;
		x: number;
		y: number;
	}
}

export const insertFx = Effect.fn("insertFx")(function* ({ tx, itemId, x, y }: insertFx.Props) {
	const id = createBoardItemId();
	yield* tryGameAction(() =>
		tx
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
