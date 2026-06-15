import { z } from "zod";

export const GameCraftRecipeIdSchema = z.enum([
	"craft:seed-water-sprout",
	"craft:sprout-water-sapling",
	"craft:sapling-water-tree",
	"craft:lumber-camp",
	"craft:quarry",
	"craft:townhall",
	"craft:lumber-camp-2",
	"craft:lumber-camp-3",
	"craft:lumber-camp-4",
	"craft:lumber-camp-5",
	"craft:quarry-2",
	"craft:quarry-3",
	"craft:quarry-4",
	"craft:quarry-5",
	"craft:townhall-2",
	"craft:townhall-3",
	"craft:townhall-4",
	"craft:townhall-5",
]);

type GameCraftRecipeIdSchema = typeof GameCraftRecipeIdSchema;
export namespace GameCraftRecipeIdSchema {
	export type Type = z.infer<GameCraftRecipeIdSchema>;
}
