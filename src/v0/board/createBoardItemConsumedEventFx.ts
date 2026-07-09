import { Effect } from "effect";
import type { GameEvent } from "~/event/GameEventSchema";

export namespace createBoardItemConsumedEventFx {
	export interface Props {
		itemId: string;
		itemInstanceId: string;
		nextQuantity?: number;
		previousQuantity?: number;
		quantity?: number;
		reason: Extract<
			GameEvent,
			{
				type: "item.consumed";
			}
		>["reason"];
	}
}

export const createBoardItemConsumedEventFx = Effect.fn("createBoardItemConsumedEventFx")(
	function* ({
		itemId,
		itemInstanceId,
		nextQuantity,
		previousQuantity,
		quantity = 1,
		reason,
	}: createBoardItemConsumedEventFx.Props) {
		const shouldIncludeQuantity =
			quantity > 1 || previousQuantity !== undefined || nextQuantity !== undefined;

		return {
			from: {
				kind: "board",
				itemInstanceId,
				...(shouldIncludeQuantity
					? {
							quantity,
						}
					: {}),
				...(previousQuantity !== undefined
					? {
							previousQuantity,
						}
					: {}),
				...(nextQuantity !== undefined
					? {
							nextQuantity,
						}
					: {}),
			},
			itemId,
			reason,
			type: "item.consumed",
		} satisfies GameEvent;
	},
);
