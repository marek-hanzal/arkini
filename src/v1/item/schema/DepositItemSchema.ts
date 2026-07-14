import { z } from "zod";

import { OutputSchema } from "~/v1/output/schema/OutputSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * A finite-resource authoring contract with configured capacity and optional depletion output.
 */
export const DepositItemSchema = z
	.object({
		...BaseItemSchema.shape,
		/**
		 * Identifies this item as a finite resource deposit.
		 */
		type: ItemEnumSchema.extract([
			"deposit",
		]),
		/**
		 * Authored initial capacity of this deposit.
		 */
		count: PositiveIntegerSchema.describe(
			"The authored positive initial capacity of this deposit.",
		),
		/**
		 * Optional output intended for deposit depletion.
		 */
		output: OutputSchema.optional().describe(
			"The optional output intended for deposit depletion.",
		),
	})
	.strict()
	.meta({
		id: "DepositItemSchema",
		description: "A finite-resource configuration with capacity and optional depletion output.",
	});

export type DepositItemSchema = typeof DepositItemSchema;

export namespace DepositItemSchema {
	export type Type = z.infer<DepositItemSchema>;
}
