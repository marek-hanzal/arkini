import { z } from "zod";

import { PositionSchema } from "~/engine/grid/schema/PositionSchema";

/** One concrete location in the universe-wide passive toolbar. */
export const ToolbarLocationSchema = z
	.object({
		scope: z.literal("toolbar"),
		position: PositionSchema.describe("The coordinates inside the one-row toolbar."),
	})
	.strict()
	.meta({
		id: "ToolbarLocationSchema",
		description: "One concrete location in the universe-wide passive toolbar.",
	});

export type ToolbarLocationSchema = typeof ToolbarLocationSchema;

export namespace ToolbarLocationSchema {
	export type Type = z.infer<ToolbarLocationSchema>;
}
