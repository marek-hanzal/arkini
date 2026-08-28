import { z } from "zod";

import { LineSchema } from "~/engine/line/schema/LineSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/** A board resource deposit that may expose its own finite production lines. */
export const DepositItemSchema = z
	.object({
		...BaseItemSchema.shape,
		/**
		 * Maximum number of this deposit's product lines that may run in parallel.
		 *
		 * Passive deposits never enqueue work, so the default remains inert until
		 * `lines` are authored.
		 */
		maxQueueSize: PositiveIntegerSchema.default(1).describe(
			"The maximum number of this deposit's product lines that may run in parallel.",
		),
		type: ItemEnumSchema.extract([
			"Deposit",
		]),
		/**
		 * Optional production lines that can consume this deposit's own charges.
		 */
		lines: z
			.tuple(
				[
					LineSchema,
				],
				LineSchema,
			)
			.optional()
			.describe("Optional product lines exposed by this deposit."),
	})
	.strict()
	.meta({
		id: "item.DepositSchema",
		description:
			"A board resource deposit that may expose finite self-consuming product lines.",
	});

export type DepositItemSchema = typeof DepositItemSchema;

export namespace DepositItemSchema {
	export type Type = z.infer<DepositItemSchema>;
}
