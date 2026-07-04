import { Effect } from "effect";
import type { GameEvent } from "~/event/GameEventSchema";

type InventoryItemConsumedEvent = Extract<
	GameEvent,
	{
		type: "item.consumed";
	}
>;

export namespace createInventoryItemConsumedEventFx {
	export interface Props {
		itemId: string;
		nextQuantity: number;
		previousQuantity: number;
		quantity: number;
		reason: InventoryItemConsumedEvent["reason"];
		slotIndex: number;
	}
}

export const createInventoryItemConsumedEventFx = Effect.fn("createInventoryItemConsumedEventFx")(
	({
		itemId,
		nextQuantity,
		previousQuantity,
		quantity,
		reason,
		slotIndex,
	}: createInventoryItemConsumedEventFx.Props) =>
		Effect.succeed({
			from: {
				kind: "inventory",
				nextQuantity,
				previousQuantity,
				quantity,
				slotIndex,
			},
			itemId,
			reason,
			type: "item.consumed",
		} satisfies InventoryItemConsumedEvent),
);
