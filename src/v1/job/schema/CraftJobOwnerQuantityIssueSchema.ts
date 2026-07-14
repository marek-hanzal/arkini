import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";

/** One active craft job owner does not represent exactly one isolated quantity. */
export const CraftJobOwnerQuantityIssueSchema = z
	.object({
		jobId: IdSchema.describe("The active craft job that owns the invalid item quantity."),
		ownerItemId: IdSchema.describe("The craft runtime item that must represent one quantity."),
		quantity: PositiveIntegerSchema.describe("The invalid craft owner quantity."),
		type: z.literal("job:craft-owner-quantity"),
	})
	.strict()
	.meta({
		id: "CraftJobOwnerQuantityIssueSchema",
		description: "One active craft job owner does not represent exactly one quantity.",
	});

export type CraftJobOwnerQuantityIssueSchema = typeof CraftJobOwnerQuantityIssueSchema;

export namespace CraftJobOwnerQuantityIssueSchema {
	export type Type = z.infer<CraftJobOwnerQuantityIssueSchema>;
}
