import { z } from "zod";

import { ArtworkCollectionFilterSchema } from "~/artwork-authoring/schema/ArtworkCollectionFilterSchema";

/** Editor catalog filters include project note links alongside canonical resource usage. */
export const ArtworkCatalogFilterSchema = z.enum([
	...ArtworkCollectionFilterSchema.options,
	"with-note",
]);

export type ArtworkCatalogFilterSchema = typeof ArtworkCatalogFilterSchema;

export namespace ArtworkCatalogFilterSchema {
	export type Type = z.infer<ArtworkCatalogFilterSchema>;
}
