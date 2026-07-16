import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { InputLocationSchema } from "~/engine/location/schema/InputLocationSchema";

/**
 * One buffered material references an owner item that no longer exists.
 */
export const InputOwnerMissingIssueSchema = z
	.object({
		itemId: IdSchema.describe("The buffered material with a missing owner."),
		location: InputLocationSchema.describe("The invalid input location."),
		type: z.literal("input:owner-missing"),
	})
	.strict()
	.meta({
		id: "InputOwnerMissingIssueSchema",
		description: "One buffered material references a missing owner item.",
	});

export type InputOwnerMissingIssueSchema = typeof InputOwnerMissingIssueSchema;

export namespace InputOwnerMissingIssueSchema {
	export type Type = z.infer<InputOwnerMissingIssueSchema>;
}
