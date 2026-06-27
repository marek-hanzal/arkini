import type { GameEvent } from "~/v0/game/event/GameEventSchema";

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
