import { z } from "zod";

/**
 * Discriminates what happens to a source item after it initiates a merge.
 */
export const SourceActionSchema = z
	.enum({
		Use: "use",
		Consume: "consume",
	})
	.meta({
		id: "merge.SourceActionSchema",
		description: "The action applied to a source item after it initiates a merge.",
	});

export type SourceActionSchema = typeof SourceActionSchema;

export namespace SourceActionSchema {
	export type Type = z.infer<SourceActionSchema>;
}
