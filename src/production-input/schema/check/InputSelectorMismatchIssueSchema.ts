import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/check/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { InputLocationSchema } from "~/item-location/schema/InputLocationSchema";

/**
 * One buffered material does not match the selector of its target input slot.
 */
export const InputSelectorMismatchIssueSchema = z
	.object({
		itemId: IdSchema.describe("The buffered material rejected by the input selector."),
		location: InputLocationSchema.describe("The mismatched input location."),
		type: RuntimeCheckIssueEnumSchema.extract([
			"InputSelectorMismatch",
		]),
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
