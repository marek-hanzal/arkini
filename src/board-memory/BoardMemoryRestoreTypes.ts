import type { GameEvent } from "~/event/GameEventSchema";

export type InventoryConsumedForMemoryRestore = {
	consumedEvents: Extract<
		GameEvent,
		{
			type: "item.consumed";
		}
	>[];
	createdAtMs?: number;
	itemInstanceId?: string;
};
