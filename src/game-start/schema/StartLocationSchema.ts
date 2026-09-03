import { z } from "zod";

import { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { InventoryLocationSchema } from "~/item-location/schema/InventoryLocationSchema";
import { PositionSchema } from "~/item-location/schema/PositionSchema";
import { ToolbarLocationSchema } from "~/item-location/schema/ToolbarLocationSchema";

const StartToolbarLocationSchema = ToolbarLocationSchema.extend({
	position: PositionSchema.extend({
		y: z
			.literal(0)
			.describe("The toolbar is one row, so its vertical coordinate is always zero."),
	}).strict(),
});

/** Identifies one exact slot in the authored initial game state. */
export const StartLocationSchema = z
	.discriminatedUnion("scope", [
		BoardLocationSchema,
		InventoryLocationSchema,
		StartToolbarLocationSchema,
	])
	.meta({
		id: "start.LocationSchema",
		description: "One exact initial board-space, inventory, or one-row toolbar location.",
	});

export type StartLocationSchema = typeof StartLocationSchema;

export namespace StartLocationSchema {
	export type Type = z.infer<StartLocationSchema>;
}
