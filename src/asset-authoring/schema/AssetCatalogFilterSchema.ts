import { z } from "zod";

import { AssetCollectionFilterSchema } from "~/asset-authoring/schema/AssetCollectionFilterSchema";

/** Editor catalog filters include project note links alongside canonical resource usage. */
export const AssetCatalogFilterSchema = z.enum([
	...AssetCollectionFilterSchema.options,
	"with-note",
]);

export type AssetCatalogFilterSchema = typeof AssetCatalogFilterSchema;

export namespace AssetCatalogFilterSchema {
	export type Type = z.infer<AssetCatalogFilterSchema>;
}
