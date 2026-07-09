import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemTypeEnumSchema } from "./ItemTypeEnumSchema";

/**
 * An item that enables the speed cheat.
 */
export const CheatSpeedOnItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemTypeEnumSchema.extract([
			"cheat:speed:on",
		]),
	})
	.strict()
	.describe("An item that enables the speed cheat.");

export type CheatSpeedOnItemSchema = typeof CheatSpeedOnItemSchema;

export namespace CheatSpeedOnItemSchema {
	export type Type = z.infer<CheatSpeedOnItemSchema>;
}
