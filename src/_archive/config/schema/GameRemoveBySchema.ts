import { z } from "zod";
import { ActivationOutputSchema } from "~/config/schema/GameActivationOutputSchema";
import { IdSchema } from "~/config/schema/GameConfigScalarSchemas";

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
