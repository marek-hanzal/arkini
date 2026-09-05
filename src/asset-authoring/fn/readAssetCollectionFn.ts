import type { Project } from "~/project-authoring/type/Project";
import { createFuzzySearchFn } from "~/fuzzy-search/fn/createFuzzySearchFn";
import { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import type { AssetCollectionFilterSchema } from "~/asset-authoring/schema/AssetCollectionFilterSchema";

export namespace readAssetCollectionFn {
	export interface Props {
		readonly config: Project["config"];
		readonly filter: AssetCollectionFilterSchema.Type;
		readonly query: string;
		readonly resources: Project["resources"];
	}
}

/** Applies the canonical usage filter and exact-first fuzzy search in catalog order. */
export const readAssetCollectionFn = ({
	config,
	filter,
	query,
	resources,
}: readAssetCollectionFn.Props): ReadonlyArray<Project.Resource> => {
	const usedResourceIds = new Set(
		readGameResourceUsagesFn(config).map(({ resourceId }) => resourceId),
	);
	const filteredResources = resources.filter(
		(resource) => filter === "all" || !usedResourceIds.has(resource.id),
	);
	const fuzzyFn = createFuzzySearchFn({
		candidates: filteredResources.map((resource) => ({
			terms: [
				resource.id,
				resource.mime,
				"PNG",
				"image",
			],
			value: resource,
		})),
	});
	return fuzzyFn(query);
};
