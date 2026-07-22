import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { ItemChargesIssueReasonEnumSchema } from "./ItemChargesIssueReasonEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";

/** One live item's persisted charge state violates the canonical charge contract. */
export const ItemChargesIssueSchema = z
	.object({
		type: RuntimeCheckIssueEnumSchema.extract([
			RuntimeCheckIssueEnumSchema.enum.ItemCharges,
		]),
		itemId: IdSchema,
		amount: PositiveIntegerSchema.optional(),
		remainingCharges: NonNegativeIntegerSchema,
		reason: ItemChargesIssueReasonEnumSchema,
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
