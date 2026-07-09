import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An item that will provide stash gameplay behavior.
 */
export const StashItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"stash",
		]),
	})
	.strict()
	.describe("An item that provides stash gameplay behavior.");

export type StashItemSchema = typeof StashItemSchema;

export namespace StashItemSchema {
	export type Type = z.infer<StashItemSchema>;
}
