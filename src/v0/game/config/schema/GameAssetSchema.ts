import { z } from "zod";
import { IdSchema } from "~/v0/game/config/schema/GameConfigScalarSchemas";

export const AssetSchema = z
	.object({
		label: z.string().min(1).optional(),
		resourceId: IdSchema,
		overlayAssetId: IdSchema.optional(),
		render: z
			.enum([
				"plain",
				"blueprint",
			])
			.default("plain"),
	})
	.strict();

export const AssetFragmentSchema = AssetSchema.extend({
	resourceId: IdSchema.optional(),
});
