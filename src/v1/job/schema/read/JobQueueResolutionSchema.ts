import { z } from "zod";

import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { JobSchema } from "~/v1/job/schema/JobSchema";

/** Current active-job queue state owned by one runtime item. */
export const JobQueueResolutionSchema = z
	.object({
		/** Active jobs in their persisted queue order. */
		jobs: z.array(JobSchema).describe("The active jobs in their persisted queue order."),
		/** Number of currently occupied queue slots. */
		used: z.number().int().nonnegative().describe("The number of occupied queue slots."),
		/** Maximum number of active jobs accepted by this owner. */
		capacity: PositiveIntegerSchema.describe(
			"The maximum number of active jobs accepted by this owner.",
		),
		/** Whether at least one queue slot is currently available. */
		available: z.boolean().describe("Whether at least one queue slot is currently available."),
	})
	.strict()
	.meta({
		id: "JobQueueResolutionSchema",
		description: "The current active-job queue state owned by one runtime item.",
	});

export type JobQueueResolutionSchema = typeof JobQueueResolutionSchema;

export namespace JobQueueResolutionSchema {
	export type Type = z.infer<JobQueueResolutionSchema>;
}
