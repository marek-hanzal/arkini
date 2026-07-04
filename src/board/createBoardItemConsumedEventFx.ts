import { Effect } from "effect";
import type { GameEvent } from "~/event/GameEventSchema";

export namespace createBoardItemConsumedEventFx {
	export interface Props {
		itemId: string;
		itemInstanceId: string;
		reason: Extract<
			GameEvent,
			{
				type: "item.consumed";
			}
		>["reason"];
	}
}

export const createBoardItemConsumedEventFx = Effect.fn("createBoardItemConsumedEventFx")(
	function* ({ itemId, itemInstanceId, reason }: createBoardItemConsumedEventFx.Props) {
		return {
			from: {
				kind: "board",
				itemInstanceId,
			},
			itemId,
			reason,
			type: "item.consumed",
		} satisfies GameEvent;
	},
);
