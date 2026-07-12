import { z } from "zod";
import { JobQueueRequestSchema } from "~/v1/job/schema/JobQueueRequestSchema";
import { JobSchema } from "~/v1/job/schema/JobSchema";
import { StateItemSchema } from "./StateItemSchema";
export const StateSchema = z
	.object({
		items: z.array(StateItemSchema),
		jobs: z.array(JobSchema),
		jobQueue: z.array(JobQueueRequestSchema).optional(),
	})
	.strict()
	.meta({
		id: "StateSchema",
		description: "Serializable gameplay state.",
	});
export type StateSchema = typeof StateSchema;
export namespace StateSchema {
	export type Type = z.infer<StateSchema>;
}
