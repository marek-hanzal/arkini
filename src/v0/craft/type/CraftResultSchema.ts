import { z } from "zod";
import { ItemInstanceIdSchema } from "~/v0/item-instance/type/ItemInstanceIdSchema";
import { GameCraftRecipeIdSchema } from "~/v0/manifest/GameCraftRecipeIdSchema";
import { GameItemIdSchema } from "~/v0/manifest/GameItemIdSchema";

export const CraftResultSchema = z.object({
	boardItemId: ItemInstanceIdSchema,
	recipeId: GameCraftRecipeIdSchema,
	sourceItemId: GameItemIdSchema,
	resultItemId: GameItemIdSchema,
});

type CraftResultSchema = typeof CraftResultSchema;
export namespace CraftResultSchema {
	export type Type = z.infer<CraftResultSchema>;
}
