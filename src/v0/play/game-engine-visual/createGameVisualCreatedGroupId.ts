import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";

type CreatedEvent = Extract<
	GameEvent,
	{
		type: "item.created";
	}
>;

export const createGameVisualCreatedGroupId = (event: CreatedEvent) =>
	`engine:${event.reason}:${event.originItemInstanceId ?? event.itemId}`;
