import { z } from "zod";

export const GameActionReadyReadinessSchema = z
	.object({
		type: z.literal("ready"),
	})
	.strict();

export type GameActionReadyReadinessSchema = typeof GameActionReadyReadinessSchema;

export namespace GameActionReadyReadinessSchema {
	export type Type = z.infer<typeof GameActionReadyReadinessSchema>;
}
