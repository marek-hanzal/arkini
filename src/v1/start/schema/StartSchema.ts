import { z } from "zod";

import { BoardItemSchema } from "./BoardItemSchema";
import { InventoryItemSchema } from "./InventoryItemSchema";

/**
 * Defines the board and inventory contents used when a new game starts.
 */
export const StartSchema = z
	.object({
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
	})
	.strict()
	.meta({
		id: "StartSchema",
		description: "The initial board placements and inventory contents for a new game.",
	});

export type StartSchema = typeof StartSchema;

export namespace StartSchema {
	export type Type = z.infer<StartSchema>;
}
