import { z } from "zod";

/**
 * Discriminates handling of the dragged item; Space is authored by the receiving item.
 */
export const SourceActionSchema = z
	.enum({
		Use: "use",
		Consume: "consume",
		Spend: "spend",
		Space: "space",
	})
	.meta({
		id: "merge.SourceActionSchema",
		description: "The action applied to the dragged item during an authored merge.",
	});

export type SourceActionSchema = typeof SourceActionSchema;

export namespace SourceActionSchema {
	export type Type = z.infer<SourceActionSchema>;
}
