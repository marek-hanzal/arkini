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
	const usedResourceUids = new Set(
		readGameResourceUsagesFn(config).map(({ resourceUid }) => resourceUid),
	);
	const filteredResources = resources.filter(
		(resource) =>
			resource.type === "artwork" &&
			(filter === "all" || !usedResourceUids.has(resource.uid)),
	);
	const fuzzyFn = createFuzzySearchFn({
		candidates: filteredResources.map((resource) => ({
			terms: [
				resource.uid,
				resource.title,
				resource.type,
				"PNG",
				"image",
			],
			value: resource,
		})),
	});
	return fuzzyFn(query);
};
