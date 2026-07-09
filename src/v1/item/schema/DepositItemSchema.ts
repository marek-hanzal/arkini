import { z } from "zod";

import { OutputSchema } from "~/v1/output/schema/OutputSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * A finite resource item that disappears after all of its capacity is used.
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
		 * Initial number of uses available to this deposit.
		 */
		count: PositiveIntegerSchema.describe(
			"The initial positive number of uses available to this deposit.",
		),
		/**
		 * Optional output evaluated when this deposit is depleted.
		 *
		 * When omitted, the deposit simply disappears after its final use.
		 */
		output: OutputSchema.optional().describe(
			"The optional output evaluated when this deposit is depleted.",
		),
	})
	.strict()
	.meta({
		id: "DepositItemSchema",
		description: "A finite resource deposit that disappears when its capacity is depleted.",
	});

export type DepositItemSchema = typeof DepositItemSchema;

export namespace DepositItemSchema {
	export type Type = z.infer<DepositItemSchema>;
}
