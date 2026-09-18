import { z } from "zod";

import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { PresentationSfxEventEnumSchema } from "~/sfx-event/schema/PresentationSfxEventEnumSchema";

/** Every committed gameplay or explicit presentation event assignable to one SFX resource. */
export const SfxEventEnumSchema = z
	.enum({
		...GameEventEnumSchema.exclude([
			"ItemRemoved",
		]).enum,
		...PresentationSfxEventEnumSchema.enum,
	})
	.meta({
		id: "SfxEventEnumSchema",
		description: "The finite vocabulary of events assignable to SFX.",
	});

export type SfxEventEnumSchema = typeof SfxEventEnumSchema;

export namespace SfxEventEnumSchema {
	export type Type = z.infer<SfxEventEnumSchema>;
}
