import { z } from "zod";

/**
 * Declares what happens to a line-owning item after one job completes.
 */
export const AfterCompletionEnumSchema = z
	.enum([
		/** Keeps the owner item and all remaining owner-scoped state. */
		"keep",
		/** Removes the owner item and releases its remaining owner-scoped state. */
		"remove",
	])
	.meta({
		id: "AfterCompletionEnumSchema",
		description: "What happens to a line-owning item after one job completes.",
	});

export type AfterCompletionEnumSchema = typeof AfterCompletionEnumSchema;

export namespace AfterCompletionEnumSchema {
	export type Type = z.infer<AfterCompletionEnumSchema>;
}
