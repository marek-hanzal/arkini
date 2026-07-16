import { Effect } from "effect";
import { createBoardItemConsumedEventFx } from "~/board/createBoardItemConsumedEventFx";
import { readGameSaveBoardItemQuantity } from "~/board/readGameSaveBoardItemQuantity";
import { removeBoardItemFromSaveFx } from "~/board/removeBoardItemFromSaveFx";
import { writeBoardItemToSaveFx } from "~/board/writeBoardItemToSaveFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";

export namespace consumeBoardItemQuantityFx {
	export interface Props {
		itemInstanceId: string;
		nextSave: GameSave;
		quantity: number;
		reason: Extract<
			GameEvent,
			{
				type: "item.consumed";
			}
		>["reason"];
		runtimeState: "remove" | "preserve";
	}

	export interface Result {
		consumedEvent: Extract<
			GameEvent,
			{
				type: "item.consumed";
			}
		>;
		itemId: string;
		nextQuantity: number;
		previousQuantity: number;
	}
}

export const consumeBoardItemQuantityFx = Effect.fn("consumeBoardItemQuantityFx")(function* ({
	itemInstanceId,
	nextSave,
	quantity,
	reason,
	runtimeState,
}: consumeBoardItemQuantityFx.Props) {
	const item = nextSave.board.items[itemInstanceId];
	if (!item) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_unavailable",
				`Missing board input "${itemInstanceId}".`,
			),
		);
	}

	const previousQuantity = readGameSaveBoardItemQuantity(item);
	const nextQuantity = previousQuantity - quantity;
	if (nextQuantity < 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_unavailable",
				`Board input "${itemInstanceId}" is already spent.`,
			),
		);
	}

	if (nextQuantity === 0) {
		yield* removeBoardItemFromSaveFx({
			itemInstanceId,
			runtimeState,
			save: nextSave,
		});
	} else {
		yield* writeBoardItemToSaveFx({
			item: {
				...item,
				quantity: nextQuantity,
			},
			save: nextSave,
		});
	}

	return {
		consumedEvent: yield* createBoardItemConsumedEventFx({
			itemId: item.itemId,
			itemInstanceId,
			nextQuantity,
			previousQuantity,
			quantity,
			reason,
		}),
		itemId: item.itemId,
		nextQuantity,
		previousQuantity,
	} satisfies consumeBoardItemQuantityFx.Result;
});
