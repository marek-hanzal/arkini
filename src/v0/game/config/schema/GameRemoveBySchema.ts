import { z } from "zod";
import { ActivationOutputSchema } from "~/v0/game/config/schema/GameActivationOutputSchema";
import { IdSchema } from "~/v0/game/config/schema/GameConfigScalarSchemas";

export const RemoveBySchema = z
	.object({
		itemId: IdSchema,
		mode: z.enum([
			"keep",
			"consume",
		]),
		output: ActivationOutputSchema.min(1).optional(),
	})
	.strict();
