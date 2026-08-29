import { z } from "zod";

import { BoardLocationSchema } from "./BoardLocationSchema";
import { InventoryLocationSchema } from "./InventoryLocationSchema";
import { ToolbarLocationSchema } from "./ToolbarLocationSchema";

/** One concrete location on a board space or in passive universe-wide storage. */
export const GridLocationSchema = z
	.discriminatedUnion("scope", [
		BoardLocationSchema,
		InventoryLocationSchema,
		ToolbarLocationSchema,
	])
	.meta({
		id: "GridLocationSchema",
		description: "One concrete board-space, inventory, or toolbar location.",
	});

export type GridLocationSchema = typeof GridLocationSchema;

export namespace GridLocationSchema {
	export type Type = z.infer<GridLocationSchema>;
}
