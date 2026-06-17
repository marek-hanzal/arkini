import { z } from "zod";
import { GameActionCraftStartSchema } from "~/v0/game/engine/model/GameActionCraftStartSchema";
import { GameActionItemMergeSchema } from "~/v0/game/engine/model/GameActionItemMergeSchema";
import { GameActionProducerProductStartSchema } from "~/v0/game/engine/model/GameActionProducerProductStartSchema";
import { GameActionStashOpenSchema } from "~/v0/game/engine/model/GameActionStashOpenSchema";
import { GameActionTileRemoveSchema } from "~/v0/game/engine/model/GameActionTileRemoveSchema";

export const GameActionSchema = z.discriminatedUnion("type", [
	GameActionCraftStartSchema,
	GameActionItemMergeSchema,
	GameActionProducerProductStartSchema,
	GameActionStashOpenSchema,
	GameActionTileRemoveSchema,
]);

export type GameActionSchema = typeof GameActionSchema;

export namespace GameActionSchema {
	export type Type = z.infer<typeof GameActionSchema>;
}

export type GameAction = GameActionSchema.Type;
