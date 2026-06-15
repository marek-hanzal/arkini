import { z } from "zod";
import { ItemInstanceIdSchema } from "~/item-instance/type/ItemInstanceIdSchema";
import { GameCraftRecipeIdSchema } from "~/manifest/GameCraftRecipeIdSchema";
import { GameItemIdSchema } from "~/manifest/GameItemIdSchema";

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
