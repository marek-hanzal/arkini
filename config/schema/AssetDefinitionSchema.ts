import { z } from "zod";
import { IdSchema } from "./IdSchema";

export const AssetDefinitionSchema = z.object({
	id: IdSchema,
	resourceId: IdSchema,
	label: z.string().optional(),
});
