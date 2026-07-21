import { z } from "zod";

export const FailedGameDiscardSearchSchema = z
	.object({
		packageId: z.string().min(1),
	})
	.strict();

export type FailedGameDiscardSearchSchema = typeof FailedGameDiscardSearchSchema;

export namespace FailedGameDiscardSearchSchema {
	export type Type = z.infer<FailedGameDiscardSearchSchema>;
}
