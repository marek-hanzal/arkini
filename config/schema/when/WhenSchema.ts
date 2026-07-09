import { z } from "zod";

import { WhenCountSchema } from "./WhenCountSchema";
import { WhenDistanceSchema } from "./WhenDistanceSchema";

/**
 * A standalone condition that produces a boolean result from game-state facts.
 *
 * Each member owns its own test and fields. The `type` discriminator keeps the
 * union explicit and directly compatible with `ts-pattern`.
 */
export const WhenSchema = z
	.discriminatedUnion("type", [
		WhenCountSchema,
		WhenDistanceSchema,
	])
	.describe("A standalone condition that produces a boolean result from game-state facts.");

export type WhenSchema = typeof WhenSchema;

export namespace WhenSchema {
	export type Type = z.infer<WhenSchema>;
}
