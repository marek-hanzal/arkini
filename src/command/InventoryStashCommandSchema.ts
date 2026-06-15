import { z } from "zod";
import { StashBoardItemInputSchema } from "~/play/schema/StashBoardItemInputSchema";

export const InventoryStashCommandSchema = StashBoardItemInputSchema.extend({
	type: z.literal("inventory.stash"),
});

type InventoryStashCommandSchema = typeof InventoryStashCommandSchema;
export namespace InventoryStashCommandSchema {
	export type Type = z.infer<InventoryStashCommandSchema>;
}
