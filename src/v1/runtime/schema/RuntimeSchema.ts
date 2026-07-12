import { z } from "zod";

import { JobSchema } from "~/v1/job/schema/JobSchema";
import { RuntimeItemSchema } from "./RuntimeItemSchema";

/**
 * Core mutable gameplay runtime composed of live items and active jobs.
 *
 * Every item owns its identity, state, and concrete location. Board and
 * inventory views are derived from these item locations instead of stored as
 * independent containers or indexes.
 */
export const RuntimeSchema = z
	.object({
		/**
		 * Every hydrated live item currently owned by the runtime.
		 */
		items: z
			.array(RuntimeItemSchema)
			.describe("Every hydrated live item currently owned by the runtime."),
		/**
		 * Every active product-line run currently owned by the runtime.
		 */
		jobs: z
			.array(JobSchema)
			.describe("Every active product-line run currently owned by the runtime."),
	})
	.strict()
	.meta({
		id: "RuntimeSchema",
		description: "The core mutable gameplay runtime composed of live items and active jobs.",
	});

export type RuntimeSchema = typeof RuntimeSchema;

export namespace RuntimeSchema {
	export type Type = z.infer<RuntimeSchema>;
}
