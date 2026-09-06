import { z } from "zod";

import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { TimeSchema } from "~/game-value/schema/TimeSchema";
import { OutputSchema } from "~/production-output/schema/OutputSchema";
import { StorageSchema } from "~/item-definition/schema/StorageSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * A Board-authored item contract with a configured lifetime.
 *
 * Every committed runtime instance starts with the authored duration, advances
 * through canonical fixed Tick steps across Board and production ownership, and
 * atomically expires with its optional output at the visible Board origin.
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
			"The optional output placed from the temporary identity's visible Board origin after expiry.",
		),
	})
	.strict()
	.meta({
		id: "item.TemporarySchema",
		description:
			"A Board-authored, non-stackable item configuration with lifetime and optional expiry output.",
	});

export type TemporarySchema = typeof TemporarySchema;

export namespace TemporarySchema {
	export type Type = z.infer<TemporarySchema>;
}
