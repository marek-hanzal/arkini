import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";

/** One live item's persisted charge state violates the canonical charge contract. */
export const ItemChargesIssueSchema = z
	.object({
		type: z.literal("item:charges"),
		itemId: IdSchema,
		amount: PositiveIntegerSchema.optional(),
		remainingCharges: NonNegativeIntegerSchema,
		reason: z.enum([
			"missing-config",
			"exceeds-amount",
			"full-state",
			"depleted-idle",
		]),
	})
	.strict()
	.meta({
		id: "ItemChargesIssueSchema",
		description: "One invalid live item charge-state diagnostic.",
	});

export type ItemChargesIssueSchema = typeof ItemChargesIssueSchema;

export namespace ItemChargesIssueSchema {
	export type Type = z.infer<ItemChargesIssueSchema>;
}
