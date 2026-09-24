import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";

export const InventoryIssueSchema = z
	.object({
		type: RuntimeCheckIssueEnumSchema.extract([
			"Inventory",
		]),
		itemId: IdSchema,
		space: NonNegativeIntegerSchema,
		reason: z.enum([
			"duplicate-owner",
			"authored-address",
			"missing-template",
		]),
	})
	.strict()
	.meta({
		id: "InventoryIssueSchema",
	});
export type InventoryIssueSchema = typeof InventoryIssueSchema;
export namespace InventoryIssueSchema {
	export type Type = z.infer<InventoryIssueSchema>;
}
