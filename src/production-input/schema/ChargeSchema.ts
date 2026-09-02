import { z } from "zod";

import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { ChargeSourceSchema } from "./ChargeSourceSchema";

/** Charge cost paid when one requirement participates in a committed action. */
export const ChargeSchema = z
	.object({
		cost: PositiveIntegerSchema.describe(
			"The positive number of charges paid when the enclosing action commits.",
		),
		from: ChargeSourceSchema.describe(
			"Whether the cost is paid by the action owner or the requirement's resolved target.",
		),
	})
	.strict()
	.meta({
		id: "input.ChargeSchema",
		description: "One action-requirement charge cost and the runtime item that pays it.",
	});

export type ChargeSchema = typeof ChargeSchema;

export namespace ChargeSchema {
	export type Type = z.infer<ChargeSchema>;
}
