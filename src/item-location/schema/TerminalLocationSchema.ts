import { z } from "zod";

import { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

/** A departed job owner retained only to finish work from its former Board origin. */
export const TerminalLocationSchema = z
	.object({
		scope: LocationScopeEnumSchema.extract([
			"Terminal",
		]),
		origin: BoardLocationSchema,
	})
	.strict()
	.meta({
		id: "TerminalLocationSchema",
		description: "A departed job owner and its retained Board origin.",
	});

export type TerminalLocationSchema = typeof TerminalLocationSchema;

export namespace TerminalLocationSchema {
	export type Type = z.infer<TerminalLocationSchema>;
}
