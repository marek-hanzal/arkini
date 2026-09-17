import { z } from "zod";

/** Presentation-owned interactions that may trigger authored SFX without a gameplay transition. */
export const PresentationSfxEventEnumSchema = z
	.enum({
		ItemDropRejected: "item-drop:rejected",
		ItemDetailOpened: "item-detail:opened",
		ItemDetailClosed: "item-detail:closed",
	})
	.meta({
		id: "PresentationSfxEventEnumSchema",
		description: "The finite vocabulary of presentation interactions assignable to SFX.",
	});

export type PresentationSfxEventEnumSchema = typeof PresentationSfxEventEnumSchema;

export namespace PresentationSfxEventEnumSchema {
	export type Type = z.infer<PresentationSfxEventEnumSchema>;
}
