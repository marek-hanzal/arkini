import { z } from "zod";

import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";

/** Authored SFX assignments keyed by the committed gameplay event that triggers them. */
export const SfxSchema = z
	.object({
		events: z
			.partialRecord(GameEventEnumSchema, IdSchema)
			.describe("SFX resource IDs assigned to committed gameplay events."),
	})
	.strict()
	.meta({
		id: "sfx.SfxSchema",
		description: "The gameplay-event SFX assignments authored for one game.",
	});

export type SfxSchema = typeof SfxSchema;

export namespace SfxSchema {
	export type Type = z.infer<SfxSchema>;
}
