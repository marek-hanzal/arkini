import { z } from "zod";

import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { RuntimeItemSchema } from "./RuntimeItemSchema";

/**
 * One live runtime item currently placed on the board or in inventory.
 */
export const GridRuntimeItemSchema = RuntimeItemSchema.extend({
	location: GridLocationSchema,
}).meta({
	id: "GridRuntimeItemSchema",
	description: "One live runtime item currently placed on a concrete grid.",
});

export type GridRuntimeItemSchema = typeof GridRuntimeItemSchema;

export namespace GridRuntimeItemSchema {
	export type Type = z.infer<GridRuntimeItemSchema>;
}
