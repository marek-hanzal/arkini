import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { JobQueueRequestSchema } from "~/v1/job/schema/JobQueueRequestSchema";
import { JobSchema } from "~/v1/job/schema/JobSchema";
import { RuntimeSessionSchema } from "~/v1/session/schema/RuntimeSessionSchema";
import { RuntimeItemSchema } from "./RuntimeItemSchema";

/** Canonical loaded runtime composed of ephemeral session state and live gameplay state. */
export const RuntimeSchema = z
	.object({
		currentSpace: NonNegativeIntegerSchema.describe(
			"The persistent board space currently presented to the player.",
		),
		session: RuntimeSessionSchema.describe(
			"Engine-visible ephemeral state for this loaded runtime session.",
		),
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
		description: "The canonical loaded runtime state value.",
	});
export type RuntimeSchema = typeof RuntimeSchema;
export namespace RuntimeSchema {
	export type Type = z.infer<RuntimeSchema>;
}
