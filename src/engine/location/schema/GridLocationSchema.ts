import { z } from "zod";

import { BoardLocationSchema } from "./BoardLocationSchema";
import { InventoryLocationSchema } from "./InventoryLocationSchema";

/** One concrete location on a board space or in the universe-wide inventory. */
export const GridLocationSchema = z
	.discriminatedUnion("scope", [
		BoardLocationSchema,
		InventoryLocationSchema,
	])
	.meta({
		id: "GridLocationSchema",
		description: "One concrete board-space or inventory location.",
	});

export type GridLocationSchema = typeof GridLocationSchema;

export namespace GridLocationSchema {
	export type Type = z.infer<GridLocationSchema>;
}
