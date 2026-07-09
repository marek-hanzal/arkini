import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemTypeEnumSchema } from "./ItemTypeEnumSchema";

/**
 * An item that disables the speed cheat.
 */
export const CheatSpeedOffItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemTypeEnumSchema.extract([
			"cheat:speed:off",
		]),
	})
	.strict()
	.describe("An item that disables the speed cheat.");

export type CheatSpeedOffItemSchema = typeof CheatSpeedOffItemSchema;

export namespace CheatSpeedOffItemSchema {
	export type Type = z.infer<CheatSpeedOffItemSchema>;
}
