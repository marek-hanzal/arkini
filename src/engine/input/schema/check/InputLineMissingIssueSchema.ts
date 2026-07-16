import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { InputLocationSchema } from "~/engine/location/schema/InputLocationSchema";

/**
 * One buffered material references a product line not owned by its owner item.
 */
export const InputLineMissingIssueSchema = z
	.object({
		itemId: IdSchema.describe("The buffered material with a missing owner line."),
		location: InputLocationSchema.describe("The invalid input location."),
		type: z.literal("input:line-missing"),
	})
	.strict()
	.meta({
		id: "InputLineMissingIssueSchema",
		description: "One buffered material references a missing owner product line.",
	});

export type InputLineMissingIssueSchema = typeof InputLineMissingIssueSchema;

export namespace InputLineMissingIssueSchema {
	export type Type = z.infer<InputLineMissingIssueSchema>;
}
