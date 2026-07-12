import { z } from "zod";
import { JobSchema } from "~/v1/job/schema/JobSchema";
import { JobStatusSchema } from "./JobStatusSchema";
export const JobResolutionSchema = z
	.object({
		job: JobSchema,
		status: JobStatusSchema,
	})
	.strict()
	.meta({
		id: "JobResolutionSchema",
		description: "Current declarative state of one active job.",
	});
export type JobResolutionSchema = typeof JobResolutionSchema;
export namespace JobResolutionSchema {
	export type Type = z.infer<JobResolutionSchema>;
}
