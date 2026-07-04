import { Effect } from "effect";
import type { BoardCell } from "~/board/BoardCellPosition";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { pushBoardItemCreatedEventFx } from "~/placement/pushBoardItemCreatedEventFx";
import { createGameItemInstanceIdFx } from "~/save/createGameItemInstanceIdFx";

export namespace placeBoardItemInstanceFx {
	export interface Props {
		cell: BoardCell;
		createdAtMs?: number;
		events: GameEvent[];
		itemId: string;
		itemInstanceId?: string;
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
	reason,
	save,
}: placeBoardItemInstanceFx.Props) {
	const placedItemInstanceId = itemInstanceId ?? (yield* createGameItemInstanceIdFx());
	save.board.items[placedItemInstanceId] = {
		...(createdAtMs !== undefined
			? {
					createdAtMs,
				}
			: {}),
		id: placedItemInstanceId,
		itemId,
		x: cell.x,
		y: cell.y,
	};
	yield* pushBoardItemCreatedEventFx({
		cell,
		events,
		itemId,
		itemInstanceId: placedItemInstanceId,
		originItemInstanceId,
		reason,
	});

	return placedItemInstanceId;
});
