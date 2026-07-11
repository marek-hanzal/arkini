import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";

/**
 * A persisted live item or item stack stored in a state grid cell.
 */
export const StateItemSchema = z
	.object({
		/**
		 * Stable identity of this live item or stack.
		 */
		id: IdSchema.describe("The stable identity of this live item or stack."),
		/**
		 * ID of the canonical item definition restored during hydration.
		 */
		itemId: IdSchema.describe(
			"The ID of the canonical item definition restored during hydration.",
		),
		/**
		 * Number of canonical items represented by this live state entry.
		 */
		quantity: PositiveIntegerSchema.describe(
			"The positive quantity represented by this live state entry.",
		),
		/**
		 * Persisted grid containing this item.
		 */
		scope: ScopeEnumSchema.extract([
			"board",
			"inventory",
		]).describe("The persisted grid containing this item."),
		/**
		 * Zero-based horizontal coordinate of this item in its persisted grid.
		 */
		x: NonNegativeIntegerSchema.describe(
			"The zero-based horizontal coordinate of this item in its persisted grid.",
		),
		/**
		 * Zero-based vertical coordinate of this item in its persisted grid.
		 */
		y: NonNegativeIntegerSchema.describe(
			"The zero-based vertical coordinate of this item in its persisted grid.",
		),
	})
	.strict()
	.meta({
		id: "StateItemSchema",
		description: "A persisted live item or item stack stored in a state grid cell.",
	});

export type StateItemSchema = typeof StateItemSchema;

export namespace StateItemSchema {
	export type Type = z.infer<StateItemSchema>;
}
