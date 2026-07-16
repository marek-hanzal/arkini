import { z } from "zod";

export const NukeSaveRequestedGameEventSchema = z
	.object({
		type: z.literal("nuke-save:requested"),
	})
	.strict()
	.meta({
		id: "NukeSaveRequestedGameEventSchema",
		description: "Presentation request to open explicit persisted-save deletion confirmation.",
	});

export type NukeSaveRequestedGameEventSchema = typeof NukeSaveRequestedGameEventSchema;

export namespace NukeSaveRequestedGameEventSchema {
	export type Type = z.infer<NukeSaveRequestedGameEventSchema>;
}
