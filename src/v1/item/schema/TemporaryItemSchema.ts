import { z } from "zod";

import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { TimeSchema } from "~/v1/common/schema/TimeSchema";
import { OutputSchema } from "~/v1/output/schema/OutputSchema";
import { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";
import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * A board-only item that expires independently from player interaction.
 *
 * Runtime starts the lifetime when an instance is created and keeps it running
 * while the player moves that instance around the board. On expiry, runtime
 * removes the item before evaluating its optional output from the released cell.
 */
export const TemporaryItemSchema = z
	.object({
		...BaseItemSchema.shape,
		/**
		 * Identifies this item as a temporary board item.
		 */
		type: ItemEnumSchema.extract([
			"temporary",
		]).describe("Identifies this item as a temporary board item."),
		/**
		 * Temporary items are always stored on the board.
		 */
		scope: ScopeEnumSchema.extract([
			"board",
		])
			.default("board")
			.describe("Restricts temporary items to board storage."),
		/**
		 * Temporary item instances never stack because each owns its lifetime.
		 */
		maxStackSize: PositiveIntegerSchema.max(1)
			.default(1)
			.describe("Fixes temporary item stacks to one instance."),
		/**
		 * Lifetime in milliseconds, starting when an item instance is created.
		 */
		durationMs: TimeSchema.min(500).describe(
			"The lifetime in milliseconds from instance creation; must be at least 500 ms.",
		),
		/**
		 * Optional result evaluated after the expired item is removed.
		 */
		output: OutputSchema.optional().describe(
			"The optional output evaluated from the released board cell after expiry.",
		),
	})
	.strict()
	.meta({
		id: "TemporaryItemSchema",
		description:
			"A board-only, non-stackable item that disappears after its lifetime and may emit an output.",
	});

export type TemporaryItemSchema = typeof TemporaryItemSchema;

export namespace TemporaryItemSchema {
	export type Type = z.infer<TemporaryItemSchema>;
}
