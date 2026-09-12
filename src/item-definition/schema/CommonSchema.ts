import { z } from "zod";

import { LineSchema } from "~/production-line/schema/LineSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * An item that provides zero or more selectable product lines.
 */
export const CommonSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Maximum accepted work count: one active job plus pending requests.
		 */
		maxQueueSize: PositiveIntegerSchema.default(1).describe(
			"The maximum number of accepted active and queued runs for this item; defaults to one.",
		),
		/**
		 * Identifies an ordinary item with optional production.
		 */
		type: TypeSchema.extract([
			"Common",
		]),
		/**
		 * Zero or more product lines provided by this item.
		 */
		lines: z
			.array(LineSchema)
			.default([])
			.describe("Optional production lines; an empty collection leaves the item passive."),
	})
	.strict()
	.meta({
		id: "item.CommonSchema",
		description: "An item that provides zero or more selectable product lines.",
	});

export type CommonSchema = typeof CommonSchema;

export namespace CommonSchema {
	export type Type = z.infer<CommonSchema>;
}
