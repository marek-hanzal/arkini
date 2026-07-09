import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An item that disables the speed cheat.
 */
export const CheatSpeedOffItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"cheat:speed:off",
		]),
	})
	.strict()
	.describe("An item that disables the speed cheat.");

export type CheatSpeedOffItemSchema = typeof CheatSpeedOffItemSchema;

export namespace CheatSpeedOffItemSchema {
	export type Type = z.infer<CheatSpeedOffItemSchema>;
}
