import { z } from "zod";

import { RuntimeItemSchema } from "./RuntimeItemSchema";

/**
 * Core mutable gameplay runtime composed only of live items.
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
	})
	.strict()
	.meta({
		id: "RuntimeSchema",
		description: "The core mutable gameplay runtime composed of live items.",
	});

export type RuntimeSchema = typeof RuntimeSchema;

export namespace RuntimeSchema {
	export type Type = z.infer<RuntimeSchema>;
}
