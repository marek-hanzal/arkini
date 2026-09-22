import { z } from "zod";

export const JobStatusEnumSchema = z
	.enum({
		Running: "running",
		Paused: "paused",
		AwaitingOutput: "awaiting-outcome",
	})
	.meta({
		id: "JobStatusEnumSchema",
		description: "The canonical running, paused, or outcome-awaiting state of one active job.",
	});

export type JobStatusEnumSchema = typeof JobStatusEnumSchema;
export namespace JobStatusEnumSchema {
	export type Type = z.infer<JobStatusEnumSchema>;
}
