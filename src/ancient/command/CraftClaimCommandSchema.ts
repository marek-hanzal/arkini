import { z } from "zod";
import { ClaimCraftInputSchema } from "~/craft/type/ClaimCraftInputSchema";

export const CraftClaimCommandSchema = ClaimCraftInputSchema.extend({
	type: z.literal("craft.claim"),
});

type CraftClaimCommandSchema = typeof CraftClaimCommandSchema;
export namespace CraftClaimCommandSchema {
	export type Type = z.infer<CraftClaimCommandSchema>;
}
