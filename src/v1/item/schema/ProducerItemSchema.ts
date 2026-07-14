import { z } from "zod";
import { LineSchema } from "~/v1/line/schema/LineSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An item that provides one or more selectable product lines.
 */
export const ProducerItemSchema = z
	.object({
		...BaseItemSchema.shape,
		/**
		 * Maximum number of this producer's product lines that may run in parallel.
		 */
		maxQueueSize: PositiveIntegerSchema.default(1).describe(
			"The maximum number of this producer's product lines that may run in parallel; defaults to one.",
		),
		/**
		 * Identifies this item as a producer with one or more product lines.
		 */
		type: ItemEnumSchema.extract([
			"producer",
		]),
		/**
		 * One or more product lines provided by this producer.
		 */
		lines: z
			.tuple(
				[
					LineSchema,
				],
				LineSchema,
			)
			.describe("One or more product lines provided by this producer."),
	})
	.strict()
	.meta({
		id: "ProducerItemSchema",
		description: "An item that provides one or more selectable product lines.",
	});

export type ProducerItemSchema = typeof ProducerItemSchema;

export namespace ProducerItemSchema {
	export type Type = z.infer<ProducerItemSchema>;
}
