import { z } from "zod";

import { CountSchema } from "./CountSchema";
import { ExistsSchema } from "./ExistsSchema";
import { RangeSchema } from "./RangeSchema";
import { LimitSchema } from "./LimitSchema";

/**
 * A standalone condition that produces a boolean result from game-state facts.
 *
 * Each member owns its own quantity comparison. The `type` discriminator keeps
 * the union explicit and directly compatible with `ts-pattern`.
 */
export const WhenSchema = z
	.discriminatedUnion("type", [
		ExistsSchema,
		CountSchema,
		RangeSchema,
		LimitSchema,
	])
	.meta({
		id: "WhenSchema",
		description:
			"A standalone condition that evaluates an item-query quantity or an item's global quantity limit.",
	});

export type WhenSchema = typeof WhenSchema;

export namespace WhenSchema {
	export type Type = z.infer<WhenSchema>;
}
