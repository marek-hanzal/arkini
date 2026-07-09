import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An item that will trigger the nuke gameplay effect.
 */
export const NukeItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"nuke",
		]),
	})
	.strict()
	.meta({
		id: "NukeItemSchema",
		description: "An item that triggers the nuke gameplay effect.",
	});

export type NukeItemSchema = typeof NukeItemSchema;

export namespace NukeItemSchema {
	export type Type = z.infer<NukeItemSchema>;
}
