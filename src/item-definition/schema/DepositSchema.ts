import { z } from "zod";

import { LineSchema } from "~/production-line/schema/LineSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/** A board resource deposit that may expose its own finite production lines. */
export const DepositSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Maximum number of this deposit's product lines that may run in parallel.
		 *
		 * Passive deposits never enqueue work, so the default remains inert until
		 * `lines` are authored.
		 */
		maxQueueSize: PositiveIntegerSchema.default(1).describe(
			"The maximum number of this deposit's product lines that may run in parallel.",
		),
		type: TypeSchema.extract([
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

export type DepositSchema = typeof DepositSchema;

export namespace DepositSchema {
	export type Type = z.infer<DepositSchema>;
}
