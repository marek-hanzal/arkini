import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";

type ConsumedEvent = Extract<
	GameEvent,
	{
		type: "item.consumed";
	}
>;

export const createGameVisualMergeSourceTileId = (event: ConsumedEvent) => {
	if (event.from.kind === "board") return event.from.itemInstanceId;

	return `inventory:${event.from.slotIndex}:${event.itemId}`;
};
