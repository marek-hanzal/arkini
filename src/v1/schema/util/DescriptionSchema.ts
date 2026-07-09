import { z } from "zod";

/**
 * Required human-readable text describing a configuration entity.
 */
export const DescriptionSchema = z
	.string()
	.trim()
	.min(1)
	.describe("A required non-empty configuration description.");

export type DescriptionSchema = typeof DescriptionSchema;

export namespace DescriptionSchema {
	export type Type = z.infer<DescriptionSchema>;
}
