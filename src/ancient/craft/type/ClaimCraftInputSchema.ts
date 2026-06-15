import { z } from "zod";
import { BoardItemIdSchema } from "~/play/schema/BoardItemIdSchema";

export const ClaimCraftInputSchema = z.object({
	boardItemId: BoardItemIdSchema,
});

type ClaimCraftInputSchema = typeof ClaimCraftInputSchema;
export namespace ClaimCraftInputSchema {
	export type Type = z.infer<ClaimCraftInputSchema>;
}
