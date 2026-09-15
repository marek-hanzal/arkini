import { z } from "zod";

/** Selects all artwork or only artwork without a canonical project reference. */
export const ArtworkCollectionFilterSchema = z
	.enum({
		All: "all",
		Unused: "unused",
	})
	.meta({
		id: "ArtworkCollectionFilterSchema",
		description: "The usage filter shared by the Editor and artwork collection tools.",
	});

export type ArtworkCollectionFilterSchema = typeof ArtworkCollectionFilterSchema;

export namespace ArtworkCollectionFilterSchema {
	export type Type = z.infer<ArtworkCollectionFilterSchema>;
}
