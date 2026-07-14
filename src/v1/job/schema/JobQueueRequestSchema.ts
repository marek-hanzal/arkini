import { z } from "zod";
import { IdSchema } from "~/v1/common/schema/IdSchema";

/** One FIFO request to start a line later through the canonical start pipeline. */
export const JobQueueRequestSchema = z
	.object({
		id: IdSchema,
		ownerItemId: IdSchema,
		lineId: IdSchema,
	})
	.strict()
	.meta({
		id: "JobQueueRequestSchema",
		description: "One queued line-start request.",
	});
export type JobQueueRequestSchema = typeof JobQueueRequestSchema;
export namespace JobQueueRequestSchema {
	export type Type = z.infer<JobQueueRequestSchema>;
}
