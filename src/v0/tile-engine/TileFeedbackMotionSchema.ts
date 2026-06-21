import { z } from "zod";

export const TileFeedbackMotionSchema = z.object({
	kind: z
		.enum([
			"bounce",
		])
		.optional(),
	delayMs: z.number().nonnegative().optional(),
	durationMs: z.number().nonnegative().optional(),
	groupId: z.string().min(1).optional(),
});

type TileFeedbackMotionSchema = typeof TileFeedbackMotionSchema;
export namespace TileFeedbackMotionSchema {
	export type Type = z.infer<TileFeedbackMotionSchema>;
}
