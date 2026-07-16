import { z } from "zod";

import { DropResultSchema } from "./DropResultSchema";

/**
 * The resolved result of one configured drop, or no result when its rules reject it.
 *
 * One configured drop can never expand into multiple concrete drops. Collection
 * composition belongs to the parent output evaluator.
 */
export const DropResolutionSchema = DropResultSchema.optional().meta({
	id: "DropResolutionSchema",
	description:
		"The concrete result of one drop evaluation, or undefined when the drop is rejected.",
});

export type DropResolutionSchema = typeof DropResolutionSchema;

export namespace DropResolutionSchema {
	export type Type = z.infer<DropResolutionSchema>;
}
