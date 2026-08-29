import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { TimeSchema } from "~/engine/common/schema/TimeSchema";
import { OutputSchema } from "~/production-output/schema/OutputSchema";
import { StorageSchema } from "~/engine/scope/schema/StorageSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * A board-only item authoring contract with a configured lifetime.
 *
 * Every committed runtime instance starts with the authored duration, advances
 * only through canonical fixed Tick steps, and atomically expires with its
 * optional output.
 */
export const TemporarySchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this item as a temporary board item.
		 */
		type: TypeSchema.extract([
			"Temporary",
		]).describe("Identifies this item as a temporary board item."),
		/**
		 * Temporary items are always stored on the board.
		 */
		scope: StorageSchema.extract([
			"Board",
		])
			.default(StorageSchema.enum.Board)
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
		id: "item.TemporarySchema",
		description:
			"A board-only, non-stackable item configuration with lifetime and optional expiry output.",
	});

export type TemporarySchema = typeof TemporarySchema;

export namespace TemporarySchema {
	export type Type = z.infer<TemporarySchema>;
}
