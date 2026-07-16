import { z } from "zod";

import { WhenCountSchema } from "./WhenCountSchema";
import { WhenExistsSchema } from "./WhenExistsSchema";
import { WhenRangeSchema } from "./WhenRangeSchema";

/**
 * A standalone condition that produces a boolean result from game-state facts.
 *
 * Each member owns its own quantity comparison. The `type` discriminator keeps
 * the union explicit and directly compatible with `ts-pattern`.
 */
export const WhenSchema = z
	.discriminatedUnion("type", [
		WhenExistsSchema,
		WhenCountSchema,
		WhenRangeSchema,
	])
	.meta({
		id: "WhenSchema",
		description: "A standalone condition that evaluates an item-query quantity.",
	});

export type WhenSchema = typeof WhenSchema;

export namespace WhenSchema {
	export type Type = z.infer<WhenSchema>;
}
