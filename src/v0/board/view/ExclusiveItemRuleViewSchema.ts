import { z } from "zod";
import { GameItemIdSchema } from "~/v0/game/config/GameIdSchema";

export const ExclusiveItemRuleViewSchema = z.object({
	itemId: GameItemIdSchema,
	blocked: z.boolean(),
});

type ExclusiveItemRuleViewSchema = typeof ExclusiveItemRuleViewSchema;
export namespace ExclusiveItemRuleViewSchema {
	export type Type = z.infer<ExclusiveItemRuleViewSchema>;
}

export type ExclusiveItemRuleView = ExclusiveItemRuleViewSchema.Type;
