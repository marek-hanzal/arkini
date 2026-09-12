import { z } from "zod";

import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { UnitSourceSchema } from "./UnitSourceSchema";

/** Unit cost paid when one requirement participates in a committed action. */
export const UnitCostSchema = z
	.object({
		cost: PositiveIntegerSchema.describe(
			"The positive number of units paid when the enclosing action commits.",
		),
		from: UnitSourceSchema.describe(
			"Whether the cost is paid by the action owner or the requirement's resolved target.",
		),
	})
	.strict()
	.meta({
		id: "input.UnitCostSchema",
		description: "One action-requirement unit cost and the runtime item that pays it.",
	});

export type UnitCostSchema = typeof UnitCostSchema;

export namespace UnitCostSchema {
	export type Type = z.infer<UnitCostSchema>;
}
