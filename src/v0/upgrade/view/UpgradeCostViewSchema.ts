import { z } from "zod";
import { GameItemIdSchema } from "~/v0/manifest/GameItemIdSchema";

export const UpgradeCostViewSchema = z.object({
	itemId: GameItemIdSchema,
	quantity: z.number().int().nonnegative(),
	available: z.number().int().nonnegative(),
});

type UpgradeCostViewSchema = typeof UpgradeCostViewSchema;
export namespace UpgradeCostViewSchema {
	export type Type = z.infer<UpgradeCostViewSchema>;
}

export type UpgradeCostView = UpgradeCostViewSchema.Type;
