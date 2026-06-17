import type { GameAction } from "~/v0/game/engine/model/GameActionSchema";

export type GameActionProducerProductStart = Extract<
	GameAction,
	{
		type: "producer.product.start";
	}
>;
