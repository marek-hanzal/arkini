import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";

import { BoardItemSchema } from "./BoardItemSchema";
import { InventoryItemSchema } from "./InventoryItemSchema";
import { ToolbarItemSchema } from "./ToolbarItemSchema";

/**
 * Defines the board, inventory, and toolbar contents used when a new game starts.
 */
export const StartSchema = z
	.object({
		currentSpace: NonNegativeIntegerSchema.describe(
			"The board space presented when a new game starts.",
		),
		/**
		 * Items placed at explicit initial board coordinates.
		 */
		board: z
			.array(BoardItemSchema)
			.default([])
			.describe("The items placed at explicit coordinates when a new game starts."),
		/**
		 * Items added to the initial inventory.
		 */
		inventory: z
			.array(InventoryItemSchema)
			.default([])
			.describe("The item quantities added to inventory when a new game starts."),
		/**
		 * Items placed at explicit initial toolbar slots.
		 */
		toolbar: z
			.array(ToolbarItemSchema)
			.default([])
			.describe("The items placed at explicit slots when a new game starts."),
	})
	.strict()
	.meta({
		id: "StartSchema",
		description:
			"The initial board placements, inventory contents, and toolbar placements for a new game.",
	});

export type StartSchema = typeof StartSchema;

export namespace StartSchema {
	export type Type = z.infer<StartSchema>;
}
