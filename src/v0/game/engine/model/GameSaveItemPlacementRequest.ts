import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";

export interface GameSaveItemPlacementRequest {
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
