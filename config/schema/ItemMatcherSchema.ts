import { z } from "zod";
import { IdSchema } from "./IdSchema";

export const ItemMatcherSchema = z.object({
	ids: z.array(IdSchema).optional(),
	tags: z.array(IdSchema).optional(),
});
