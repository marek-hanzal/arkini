import type { GameEvent } from "~/event/GameEventSchema";

export interface GameSaveItemPlacementRequest {
	createdAtMs?: number;
	itemId: string;
	quantity: number;
	reason: Extract<
		GameEvent,
		{
			type: "item.created";
		}
	>["reason"];
	originItemInstanceId?: string;
}
