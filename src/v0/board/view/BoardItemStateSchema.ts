import { z } from "zod";
import { CraftRuntimeStateSchema } from "~/v0/craft/type/CraftRuntimeStateSchema";

export const BoardItemStateSchema = z.object({
	activation: z
		.object({
			cooldownUntil: z.string().optional(),
			remainingCharges: z.number().optional(),
		})
		.optional(),
	craft: CraftRuntimeStateSchema.optional(),
});
