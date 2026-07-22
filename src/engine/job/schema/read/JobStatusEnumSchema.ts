import { z } from "zod";

export const JobStatusEnumSchema = z
	.enum({
		Running: "running",
		Paused: "paused",
		AwaitingOutput: "awaiting-output",
	})
	.meta({
		id: "JobStatusEnumSchema",
		description: "The canonical running, paused, or output-awaiting state of one active job.",
	});

export type JobStatusEnumSchema = typeof JobStatusEnumSchema;
export namespace JobStatusEnumSchema {
	export type Type = z.infer<JobStatusEnumSchema>;
}
