import { z } from "zod";

import { LineSchema } from "~/engine/line/schema/LineSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * An item that provides one or more selectable product lines.
 */
export const ProducerSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Maximum number of this producer's product lines that may run in parallel.
		 */
		maxQueueSize: PositiveIntegerSchema.default(1).describe(
			"The maximum number of this producer's product lines that may run in parallel; defaults to one.",
		),
		/**
		 * Identifies this item as a producer with one or more product lines.
		 */
		type: TypeSchema.extract([
			"Producer",
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
		id: "item.ProducerSchema",
		description: "An item that provides one or more selectable product lines.",
	});

export type ProducerSchema = typeof ProducerSchema;

export namespace ProducerSchema {
	export type Type = z.infer<ProducerSchema>;
}
