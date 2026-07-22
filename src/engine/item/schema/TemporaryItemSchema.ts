import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { TimeSchema } from "~/engine/common/schema/TimeSchema";
import { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * A board-only item authoring contract with a configured lifetime.
 *
 * Every committed runtime instance starts with the authored duration, advances
 * only through canonical fixed Tick steps, and atomically expires with its
 * optional output.
 */
export const TemporaryItemSchema = z
	.object({
		...BaseItemSchema.shape,
		/**
		 * Identifies this item as a temporary board item.
		 */
		type: ItemEnumSchema.extract(["Temporary"]).describe("Identifies this item as a temporary board item."),
		/**
		 * Temporary items are always stored on the board.
		 */
		scope: StorageScopeEnumSchema.extract(["Board"])
			.default(StorageScopeEnumSchema.enum.Board)
			.describe("Restricts temporary items to board storage."),
		/**
		 * Temporary item instances never stack because each owns its lifetime.
		 */
		maxStackSize: PositiveIntegerSchema.max(1)
			.default(1)
			.describe("Fixes temporary item stacks to one instance."),
		/**
		 * Authored lifetime in milliseconds for fixed-step runtime expiry.
		 */
		durationMs: TimeSchema.min(500).describe(
			"The authored lifetime in milliseconds; must be at least 500 ms.",
		),
		/**
		 * Optional result resolved atomically when the item expires.
		 */
		output: OutputSchema.optional().describe(
			"The optional output intended for the released board cell after expiry.",
		),
	})
	.strict()
	.meta({
		id: "TemporaryItemSchema",
		description:
			"A board-only, non-stackable item configuration with lifetime and optional expiry output.",
	});

export type TemporaryItemSchema = typeof TemporaryItemSchema;

export namespace TemporaryItemSchema {
	export type Type = z.infer<TemporaryItemSchema>;
}
