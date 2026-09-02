import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import { ItemChargesIssueReasonEnumSchema } from "./ItemChargesIssueReasonEnumSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";

/** One live item's persisted charge state violates the canonical charge contract. */
export const ItemChargesIssueSchema = z
	.object({
		type: RuntimeCheckIssueEnumSchema.extract([
			"ItemCharges",
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
