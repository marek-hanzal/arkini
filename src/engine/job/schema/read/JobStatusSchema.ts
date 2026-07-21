import { z } from "zod";
export const JobStatusSchema = z
	.enum([
		"running",
		"paused",
		"awaiting-output",
	])
	.meta({
		id: "JobStatusSchema",
		description: "The canonical running, paused, or output-awaiting state of one active job.",
	});
export type JobStatusSchema = typeof JobStatusSchema;
export namespace JobStatusSchema {
	export type Type = z.infer<JobStatusSchema>;
}
