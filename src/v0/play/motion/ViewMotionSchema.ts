import { z } from "zod";
import { EnterMotionSchema } from "~/v0/play/motion/EnterMotionSchema";

export const ViewMotionSchema = z.object({
	enter: EnterMotionSchema.optional(),
});

type ViewMotionSchema = typeof ViewMotionSchema;
export namespace ViewMotionSchema {
	export type Type = z.infer<ViewMotionSchema>;
}
