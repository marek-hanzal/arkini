import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { SfxEventEnumSchema } from "~/sfx-event/schema/SfxEventEnumSchema";

/** Authored SFX assignments keyed by the gameplay or presentation event that triggers them. */
export const SfxSchema = z
	.object({
		events: z
			.partialRecord(SfxEventEnumSchema, IdSchema)
			.describe("SFX resource IDs assigned to gameplay and presentation events."),
	})
	.strict()
	.meta({
		id: "sfx.SfxSchema",
		description: "The event SFX assignments authored for one game.",
	});

export type SfxSchema = typeof SfxSchema;

export namespace SfxSchema {
	export type Type = z.infer<SfxSchema>;
}
