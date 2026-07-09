import { z } from "zod";

/**
 * Required human-readable title for a configuration entity.
 */
export const TitleSchema = z
	.string()
	.trim()
	.min(1)
	.describe("A required non-empty configuration title.");

export type TitleSchema = typeof TitleSchema;

export namespace TitleSchema {
	export type Type = z.infer<TitleSchema>;
}
