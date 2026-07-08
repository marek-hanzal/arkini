import { z } from "zod";
import { IdSchema } from "./IdSchema";

export const FactRequirementSchema = z.object({
	all: z.array(IdSchema).optional(),
	none: z.array(IdSchema).optional(),
});
