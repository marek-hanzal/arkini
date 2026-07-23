import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { PositionSchema } from "~/engine/grid/schema/PositionSchema";

/**
 * Places one item instance at an explicit slot in the initial toolbar.
 */
export const ToolbarItemSchema = z
	.object({
		/**
		 * Canonical item placed in the toolbar.
		 */
		itemId: IdSchema.describe("The canonical item ID placed in the initial toolbar."),
		position: PositionSchema.describe("The exact zero-based initial toolbar slot."),
	})
	.strict()
	.meta({
		id: "start.ToolbarItemSchema",
		description: "One canonical item placed at an explicit initial toolbar slot.",
	});

export type ToolbarItemSchema = typeof ToolbarItemSchema;

export namespace ToolbarItemSchema {
	export type Type = z.infer<ToolbarItemSchema>;
}
