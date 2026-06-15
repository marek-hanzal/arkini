import { z } from "zod";

export const EnterMotionSchema = z.object({
	delayMs: z.number().nonnegative().optional(),
});

type EnterMotionSchema = typeof EnterMotionSchema;
export namespace EnterMotionSchema {
	export type Type = z.infer<EnterMotionSchema>;
}
