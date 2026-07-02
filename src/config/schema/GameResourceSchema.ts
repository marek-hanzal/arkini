import { z } from "zod";

export const ResourceSchema = z
	.object({
		data: z.string().min(1),
	})
	.strict();
