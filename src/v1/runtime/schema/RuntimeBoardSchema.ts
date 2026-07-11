import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { RuntimeItemSchema } from "./RuntimeItemSchema";

/**
 * Hydrated live board items keyed by their grid cell.
 */
export const RuntimeBoardSchema = z
	.object({
		/**
		 * Hydrated board items keyed by their grid cell.
		 */
		cells: z
			.record(IdSchema, RuntimeItemSchema)
			.describe("Hydrated board items keyed by their grid cell."),
	})
	.strict()
	.meta({
		id: "RuntimeBoardSchema",
		description: "The hydrated live board grid.",
	});

export type RuntimeBoardSchema = typeof RuntimeBoardSchema;

export namespace RuntimeBoardSchema {
	export type Type = z.infer<RuntimeBoardSchema>;
}
