import { z } from "zod";

const IdSchema = z.string().min(1);

export const GameActionCraftStartSchema = z
	.object({
		recipeId: IdSchema,
		targetItemInstanceId: IdSchema,
		type: z.literal("craft.start"),
	})
	.strict();

export namespace GameActionCraftStartSchema {
	export type Type = z.infer<typeof GameActionCraftStartSchema>;
}
