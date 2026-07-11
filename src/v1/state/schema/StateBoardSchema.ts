import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { StateItemSchema } from "./StateItemSchema";

/**
 * Persisted board items keyed by their grid cell.
 */
export const StateBoardSchema = z
	.object({
		/**
		 * Persisted board items keyed by their grid cell.
		 */
		cells: z
			.record(IdSchema, StateItemSchema)
			.describe("Persisted board items keyed by their grid cell."),
	})
	.strict()
	.meta({
		id: "StateBoardSchema",
		description: "The persisted board grid.",
	});

export type StateBoardSchema = typeof StateBoardSchema;

export namespace StateBoardSchema {
	export type Type = z.infer<StateBoardSchema>;
}
