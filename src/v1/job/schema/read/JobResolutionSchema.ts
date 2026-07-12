import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { JobSchema } from "~/v1/job/schema/JobSchema";
import { JobStatusSchema } from "./JobStatusSchema";

/** Current declarative queue state of one persistent job. */
export const JobResolutionSchema = z
	.object({
		job: JobSchema.describe("The persistent job represented by this state."),
		queueIndex: z.number().int().nonnegative().describe("The job index in its owner queue."),
		previousJobId: IdSchema.optional().describe("The preceding job in the same owner queue."),
		status: JobStatusSchema.describe("The current derived execution state of this job."),
	})
	.strict()
	.meta({
		id: "JobResolutionSchema",
		description: "The current declarative queue state of one persistent job.",
	});

export type JobResolutionSchema = typeof JobResolutionSchema;

export namespace JobResolutionSchema {
	export type Type = z.infer<JobResolutionSchema>;
}
