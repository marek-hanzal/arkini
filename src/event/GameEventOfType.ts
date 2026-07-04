import type { GameEvent } from "~/event/GameEventSchema";

export type GameEventOfType<TType extends GameEvent["type"]> = Extract<
	GameEvent,
	{
		type: TType;
	}
>;
