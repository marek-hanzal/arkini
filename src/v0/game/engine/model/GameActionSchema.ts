import { z } from "zod";
import { GameActionProducerProductStartSchema } from "~/v0/game/engine/model/GameActionProducerProductStartSchema";
import { GameActionStashOpenSchema } from "~/v0/game/engine/model/GameActionStashOpenSchema";

export const GameActionSchema = z.discriminatedUnion("type", [
	GameActionProducerProductStartSchema,
	GameActionStashOpenSchema,
]);

export type GameActionSchema = typeof GameActionSchema;

export namespace GameActionSchema {
	export type Type = z.infer<typeof GameActionSchema>;
}

export type GameAction = GameActionSchema.Type;
