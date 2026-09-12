import { z } from "zod";

import { LineSchema } from "~/production-line/schema/LineSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * An item that provides one or more selectable product lines.
 */
export const ProducerSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Maximum accepted work count: one active job plus pending requests.
		 */
		maxQueueSize: PositiveIntegerSchema.default(1).describe(
			"The maximum number of accepted active and queued runs for this producer; defaults to one.",
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
