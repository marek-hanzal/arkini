import { Effect } from "effect";
import type { BoardCell } from "~/board/BoardCellPosition";
import type { GameEvent } from "~/event/GameEventSchema";

export namespace pushBoardItemCreatedEventFx {
	export interface Props {
		cell: BoardCell;
		events: GameEvent[];
		itemId: string;
		itemInstanceId: string;
		originItemInstanceId?: string;
		reason: Extract<
			GameEvent,
			{
				type: "item.created";
			}
		>["reason"];
	}
}

export const pushBoardItemCreatedEventFx = Effect.fn("pushBoardItemCreatedEventFx")(function* ({
	cell,
	events,
	itemId,
	itemInstanceId,
	originItemInstanceId,
	reason,
}: pushBoardItemCreatedEventFx.Props) {
	events.push({
		itemId,
		originItemInstanceId,
		reason,
		to: {
			kind: "board",
			itemInstanceId,
			x: cell.x,
			y: cell.y,
		},
		type: "item.created",
	});
});
