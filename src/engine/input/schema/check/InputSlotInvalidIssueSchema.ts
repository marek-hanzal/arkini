import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { InputLocationSchema } from "~/engine/location/schema/InputLocationSchema";

/**
 * One buffered material references a missing or non-material input position.
 */
export const InputSlotInvalidIssueSchema = z
	.object({
		itemId: IdSchema.describe("The buffered material with an invalid input position."),
		location: InputLocationSchema.describe("The invalid input location."),
		type: z.literal("input:slot-invalid"),
	})
	.strict()
	.meta({
		id: "InputSlotInvalidIssueSchema",
		description: "One buffered material references an invalid input position.",
	});

export type InputSlotInvalidIssueSchema = typeof InputSlotInvalidIssueSchema;

export namespace InputSlotInvalidIssueSchema {
	export type Type = z.infer<InputSlotInvalidIssueSchema>;
}
