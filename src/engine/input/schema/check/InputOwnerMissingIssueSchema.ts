import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { InputLocationSchema } from "~/engine/location/schema/InputLocationSchema";

/**
 * One buffered material references an owner item that no longer exists.
 */
export const InputOwnerMissingIssueSchema = z
	.object({
		itemId: IdSchema.describe("The buffered material with a missing owner."),
		location: InputLocationSchema.describe("The invalid input location."),
		type: RuntimeCheckIssueEnumSchema.extract([
			RuntimeCheckIssueEnumSchema.enum.InputOwnerMissing,
		]),
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
