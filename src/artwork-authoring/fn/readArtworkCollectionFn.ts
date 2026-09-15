import type { Project } from "~/project-authoring/type/Project";
import { createFuzzySearchFn } from "~/fuzzy-search/fn/createFuzzySearchFn";
import { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import type { ArtworkCollectionFilterSchema } from "~/artwork-authoring/schema/ArtworkCollectionFilterSchema";

export namespace readArtworkCollectionFn {
	export interface Props {
		readonly config: Project["config"];
		readonly filter: ArtworkCollectionFilterSchema.Type;
		readonly query: string;
		readonly resources: Project["resources"];
	}
}

/** Applies the canonical usage filter and exact-first fuzzy search in catalog order. */
export const readArtworkCollectionFn = ({
	config,
	filter,
	query,
	resources,
}: readArtworkCollectionFn.Props): ReadonlyArray<Project.Resource> => {
	const usedResourceIds = new Set(
		readGameResourceUsagesFn(config).map(({ resourceId }) => resourceId),
	);
	const filteredResources = resources.filter(
		(resource) =>
			resource.type === "artwork" && (filter === "all" || !usedResourceIds.has(resource.id)),
	);
	const fuzzyFn = createFuzzySearchFn({
		candidates: filteredResources.map((resource) => ({
			terms: [
				resource.id,
				resource.type,
				"PNG",
				"image",
			],
			value: resource,
		})),
	});
	return fuzzyFn(query);
};
