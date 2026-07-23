import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { PositionSchema } from "~/engine/grid/schema/PositionSchema";

import { LocationScopeEnumSchema } from "./LocationScopeEnumSchema";
/** One concrete board-space location usable as a spatial gameplay origin. */
export const BoardLocationSchema = z
	.object({
		scope: LocationScopeEnumSchema.extract([
			"Board",
		]),
		space: NonNegativeIntegerSchema.describe("The explicit board space containing the item."),
		position: PositionSchema.describe("The coordinates inside the board space."),
	})
	.strict()
	.meta({
		id: "BoardLocationSchema",
		description: "One concrete board-space location usable as a spatial gameplay origin.",
	});

export type BoardLocationSchema = typeof BoardLocationSchema;

export namespace BoardLocationSchema {
	export type Type = z.infer<BoardLocationSchema>;
}
