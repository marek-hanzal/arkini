import { Effect } from "effect";
import type { GameEvent } from "~/event/GameEventSchema";

export namespace pushInventoryItemCreatedEventFx {
	export interface Props {
		events: GameEvent[];
		itemId: string;
		nextQuantity: number;
		originItemInstanceId?: string;
		previousQuantity: number;
		quantity: number;
		reason: Extract<
			GameEvent,
			{
				type: "item.created";
			}
		>["reason"];
		slotIndex: number;
	}
}

export const pushInventoryItemCreatedEventFx = Effect.fn("pushInventoryItemCreatedEventFx")(
	function* ({
		events,
		itemId,
		nextQuantity,
		originItemInstanceId,
		previousQuantity,
		quantity,
		reason,
		slotIndex,
	}: pushInventoryItemCreatedEventFx.Props) {
		events.push({
			itemId,
			originItemInstanceId,
			reason,
			to: {
				kind: "inventory",
				nextQuantity,
				previousQuantity,
				quantity,
				slotIndex,
			},
			type: "item.created",
		});
	},
);
