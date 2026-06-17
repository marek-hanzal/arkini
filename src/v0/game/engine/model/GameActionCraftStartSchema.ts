import { z } from "zod";
import { GameActionItemRefSchema } from "~/v0/game/engine/model/GameActionItemRefSchema";

const IdSchema = z.string().min(1);

export const GameActionCraftStartSchema = z
	.object({
		inputRefs: z.array(GameActionItemRefSchema),
		recipeId: IdSchema,
		requirementRefs: z.array(GameActionItemRefSchema),
		type: z.literal("craft.start"),
	})
	.strict();

export type GameActionCraftStartSchema = typeof GameActionCraftStartSchema;

export namespace GameActionCraftStartSchema {
	export type Type = z.infer<typeof GameActionCraftStartSchema>;
}
