import { Effect } from "effect";
import { readGameSaveBoardItemQuantity } from "~/board/readGameSaveBoardItemQuantity";
import { writeBoardItemToSaveFx } from "~/board/writeBoardItemToSaveFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace addBoardItemQuantityFx {
	export interface Props {
		itemInstanceId: string;
		quantity: number;
		save: GameSave;
	}
}

export const addBoardItemQuantityFx = Effect.fn("addBoardItemQuantityFx")(function* ({
	itemInstanceId,
	quantity,
	save,
}: addBoardItemQuantityFx.Props) {
	const item = save.board.items[itemInstanceId];
	if (!item) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Board item "${itemInstanceId}" disappeared.`,
			),
		);
	}

	const previousQuantity = readGameSaveBoardItemQuantity(item);
	const nextQuantity = previousQuantity + quantity;
	yield* writeBoardItemToSaveFx({
		item: {
			...item,
			quantity: nextQuantity,
		},
		save,
	});

	return {
		item,
		nextQuantity,
		previousQuantity,
	};
});
