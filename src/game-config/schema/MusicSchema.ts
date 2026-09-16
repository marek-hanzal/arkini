import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";

/** Authored project Music behavior independent of the Music resource library. */
export const MusicSchema = z
	.object({
		playlist: IdSchema.array()
			.refine((ids) => new Set(ids).size === ids.length, {
				message: "Music playlist resource IDs must be unique.",
			})
			.describe("Music resource IDs included in the global random playlist."),
	})
	.strict()
	.meta({
		id: "music.MusicSchema",
		description: "The global random Music playlist authored for one game.",
	});

export type MusicSchema = typeof MusicSchema;

export namespace MusicSchema {
	export type Type = z.infer<MusicSchema>;
}
