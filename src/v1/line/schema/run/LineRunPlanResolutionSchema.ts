import { z } from "zod";

import { LineRunPlanSchema } from "./LineRunPlanSchema";

/**
 * Optional exact plan for one product-line run.
 *
 * `undefined` means that the line is disabled or at least one input is not ready.
 */
export const LineRunPlanResolutionSchema = LineRunPlanSchema.optional().meta({
	id: "LineRunPlanResolutionSchema",
	description: "One exact product-line run plan, or undefined while the line cannot start.",
});

export type LineRunPlanResolutionSchema = typeof LineRunPlanResolutionSchema;

export namespace LineRunPlanResolutionSchema {
	export type Type = z.infer<LineRunPlanResolutionSchema>;
}
