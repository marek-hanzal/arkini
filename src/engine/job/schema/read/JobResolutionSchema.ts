import { z } from "zod";
import { JobSchema } from "~/engine/job/schema/JobSchema";
import { JobStatusEnumSchema } from "./JobStatusEnumSchema";
export const JobResolutionSchema = z
	.object({
		job: JobSchema,
		status: JobStatusEnumSchema,
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
