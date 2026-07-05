import type { GameEvent } from "~/event/GameEventSchema";

export type InventoryConsumedForMemoryRestore = {
	consumedEvent: Extract<
		GameEvent,
		{
			type: "item.consumed";
		}
	>;
	createdAtMs?: number;
	itemInstanceId?: string;
};
