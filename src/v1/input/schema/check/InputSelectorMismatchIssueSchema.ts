import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { InputLocationSchema } from "~/v1/location/schema/InputLocationSchema";

/**
 * One buffered material does not match the selector of its target input slot.
 */
export const InputSelectorMismatchIssueSchema = z
	.object({
		itemId: IdSchema.describe("The buffered material rejected by the input selector."),
		location: InputLocationSchema.describe("The mismatched input location."),
		type: z.literal("input:selector-mismatch"),
	})
	.strict()
	.meta({
		id: "InputSelectorMismatchIssueSchema",
		description: "One buffered material does not match its input selector.",
	});

export type InputSelectorMismatchIssueSchema = typeof InputSelectorMismatchIssueSchema;

export namespace InputSelectorMismatchIssueSchema {
	export type Type = z.infer<InputSelectorMismatchIssueSchema>;
}
