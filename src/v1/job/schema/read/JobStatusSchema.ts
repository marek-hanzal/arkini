import { z } from "zod";

/** Current derived execution state of one persistent job. */
export const JobStatusSchema = z
	.enum([
		"queued",
		"running",
		"ready",
	])
	.meta({
		id: "JobStatusSchema",
		description: "The current derived execution state of one persistent job.",
	});

export type JobStatusSchema = typeof JobStatusSchema;

export namespace JobStatusSchema {
	export type Type = z.infer<JobStatusSchema>;
}
