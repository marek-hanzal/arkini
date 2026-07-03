import type { GameEvent } from "~/event/GameEventSchema";
import type { GameVisualMotion } from "~/play/game-engine-visual/GameVisualMotion";

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
	if (reason === "memory-restore" || reason === "memory-store") return "memory";
	return "inventory";
};
