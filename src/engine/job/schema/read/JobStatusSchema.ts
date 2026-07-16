import { z } from "zod";
export const JobStatusSchema = z
	.enum([
		"running",
		"paused",
		"ready",
	])
	.meta({
		id: "JobStatusSchema",
		description: "The current derived execution state of one active job.",
	});
export type JobStatusSchema = typeof JobStatusSchema;
export namespace JobStatusSchema {
	export type Type = z.infer<JobStatusSchema>;
}
