import { z } from "zod";

/**
 * Board distance bucket used when matching board items.
 */
export const RuleDistanceSchema = z
	.enum([
		"neighbour",
		"near",
		"far",
	])
	.describe("Board distance bucket used when matching board items.");

export type RuleDistanceSchema = typeof RuleDistanceSchema;

export namespace RuleDistanceSchema {
	export type Type = z.infer<RuleDistanceSchema>;
}
