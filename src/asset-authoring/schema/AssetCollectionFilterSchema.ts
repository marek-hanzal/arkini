import { z } from "zod";

/** Selects all assets or only assets without a canonical project reference. */
export const AssetCollectionFilterSchema = z
	.enum({
		All: "all",
		Unused: "unused",
	})
	.meta({
		id: "AssetCollectionFilterSchema",
		description: "The usage filter shared by the Editor and asset collection tools.",
	});

export type AssetCollectionFilterSchema = typeof AssetCollectionFilterSchema;

export namespace AssetCollectionFilterSchema {
	export type Type = z.infer<AssetCollectionFilterSchema>;
}
