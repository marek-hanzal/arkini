import type { GameEvent } from "~/event/GameEventSchema";

type CreatedEvent = Extract<
	GameEvent,
	{
		type: "item.created";
	}
>;

export const createGameVisualCreatedGroupId = (event: CreatedEvent) =>
	`engine:${event.reason}:${event.originItemInstanceId ?? event.itemId}`;
