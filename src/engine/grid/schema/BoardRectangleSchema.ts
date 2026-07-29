import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";

import { GridSizeSchema } from "./GridSizeSchema";
import { PositionSchema } from "./PositionSchema";

/**
 * One immutable Board placement origin used by shared spatial calculations.
 *
 * It captures the exact space, anchor, and effective footprint without adding
 * derived occupancy to runtime state.
 */
export const BoardRectangleSchema = z
	.object({
		space: NonNegativeIntegerSchema.describe("The exact Board space containing the rectangle."),
		anchor: PositionSchema.describe("The top-left Board anchor of the rectangle."),
		footprint: GridSizeSchema.describe("The effective footprint at the captured origin."),
	})
	.strict()
	.meta({
		id: "BoardRectangleSchema",
		description: "One Board space, anchor, and effective rectangular footprint.",
	});

export type BoardRectangleSchema = typeof BoardRectangleSchema;

export namespace BoardRectangleSchema {
	export type Type = z.infer<BoardRectangleSchema>;
}
