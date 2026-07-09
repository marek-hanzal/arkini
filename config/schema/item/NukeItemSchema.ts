import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemTypeEnumSchema } from "./ItemTypeEnumSchema";

/**
 * An item that will trigger the nuke gameplay effect.
 */
export const NukeItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemTypeEnumSchema.extract([
			"nuke",
		]),
	})
	.strict()
	.describe("An item that triggers the nuke gameplay effect.");

export type NukeItemSchema = typeof NukeItemSchema;

export namespace NukeItemSchema {
	export type Type = z.infer<NukeItemSchema>;
}
