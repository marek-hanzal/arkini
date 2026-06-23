import { z } from "zod";

export const GameActionReadyReadinessSchema = z
	.object({
		type: z.literal("ready"),
	})
	.strict();
