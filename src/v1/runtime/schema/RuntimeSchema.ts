import { z } from "zod";

import { JobQueueRequestSchema } from "~/v1/job/schema/JobQueueRequestSchema";
import { JobSchema } from "~/v1/job/schema/JobSchema";
import { RuntimeItemSchema } from "./RuntimeItemSchema";

/** Canonical gameplay state value composed of live items, active jobs, and queued start requests. */
export const RuntimeSchema = z
	.object({
		items: z
			.array(RuntimeItemSchema)
			.describe("Every hydrated live item currently owned by the runtime."),
		jobs: z
			.array(JobSchema)
			.describe("Every active product-line run currently owned by the runtime."),
		jobQueue: z
			.array(JobQueueRequestSchema)
			.optional()
			.describe("FIFO line-start requests not started yet."),
	})
	.strict()
	.meta({
		id: "RuntimeSchema",
		description: "The canonical gameplay state value.",
	});
export type RuntimeSchema = typeof RuntimeSchema;
export namespace RuntimeSchema {
	export type Type = z.infer<RuntimeSchema>;
}
