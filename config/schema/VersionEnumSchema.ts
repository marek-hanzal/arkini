import { z } from "zod";

/**
 * Versions of the top-level game configuration format supported by the game.
 */
export const VersionEnumSchema = z
	.enum([
		"1.0",
	])
	.describe("The supported game configuration format version.");

export type VersionEnumSchema = typeof VersionEnumSchema;

export namespace VersionEnumSchema {
	export type Type = z.infer<VersionEnumSchema>;
}
