import { Effect } from "effect";
import type { BoardCell } from "~/board/BoardCellPosition";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { pushBoardItemCreatedEventFx } from "~/placement/pushBoardItemCreatedEventFx";
import { writeBoardItemToSaveFx } from "~/board/writeBoardItemToSaveFx";
import { createGameItemInstanceIdFx } from "~/save/createGameItemInstanceIdFx";

export namespace placeBoardItemInstanceFx {
	export interface Props {
		cell: BoardCell;
		createdAtMs?: number;
		events: GameEvent[];
		itemId: string;
		itemInstanceId?: string;
		quantity?: number;
		originItemInstanceId?: string;
		reason: Extract<
			GameEvent,
			{
				type: "item.created";
			}
		>["reason"];
		save: GameSave;
	}
}

export const placeBoardItemInstanceFx = Effect.fn("placeBoardItemInstanceFx")(function* ({
	cell,
	createdAtMs,
	events,
	itemId,
	itemInstanceId,
	originItemInstanceId,
	quantity = 1,
	reason,
	save,
}: placeBoardItemInstanceFx.Props) {
	const placedItemInstanceId = itemInstanceId ?? (yield* createGameItemInstanceIdFx());
	yield* writeBoardItemToSaveFx({
		item: {
			...(createdAtMs !== undefined
				? {
						createdAtMs,
					}
				: {}),
			id: placedItemInstanceId,
			itemId,
			...(quantity > 1
				? {
						quantity,
					}
				: {}),
			x: cell.x,
			y: cell.y,
		},
		save,
	});
	yield* pushBoardItemCreatedEventFx({
		cell,
		events,
		itemId,
		itemInstanceId: placedItemInstanceId,
		quantity,
		originItemInstanceId,
		reason,
	});

	return placedItemInstanceId;
});
