import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import { ItemUnitsIssueReasonEnumSchema } from "./ItemUnitsIssueReasonEnumSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";

/** One live item's persisted unit state violates the canonical unit contract. */
export const ItemUnitsIssueSchema = z
	.object({
		type: RuntimeCheckIssueEnumSchema.extract([
			"ItemUnits",
		]),
		itemId: IdSchema,
		amount: PositiveIntegerSchema.optional(),
		remainingUnits: NonNegativeIntegerSchema,
		reason: ItemUnitsIssueReasonEnumSchema,
	})
	.strict()
	.meta({
		id: "ItemUnitsIssueSchema",
		description: "One invalid live item unit-state diagnostic.",
	});

export type ItemUnitsIssueSchema = typeof ItemUnitsIssueSchema;

export namespace ItemUnitsIssueSchema {
	export type Type = z.infer<ItemUnitsIssueSchema>;
}
