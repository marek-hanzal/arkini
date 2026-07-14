import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An authoring marker for the nuke gameplay capability.
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
		description: "An authored item marker for a future nuke gameplay capability.",
	});

export type NukeItemSchema = typeof NukeItemSchema;

export namespace NukeItemSchema {
	export type Type = z.infer<NukeItemSchema>;
}
