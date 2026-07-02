import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameVisualMotion } from "~/v0/play/game-engine-visual/GameVisualMotion";

type CreatedEvent = Extract<
	GameEvent,
	{
		type: "item.created";
	}
>;

export const readGameVisualCreatedCause = (
	reason: CreatedEvent["reason"],
): GameVisualMotion["cause"] => {
	if (reason === "line-output" || reason === "producer-input-withdraw") return "producer";
	if (reason === "craft-input-withdraw") return "craft";
	return "inventory";
};
