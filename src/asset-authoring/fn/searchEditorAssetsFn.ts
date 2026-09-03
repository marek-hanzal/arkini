import type { Project } from "~/project-authoring/type/Project";
import { createFuzzySearchFn } from "~/fuzzy-search/fn/createFuzzySearchFn";

/** Applies the Editor Asset library's exact-first Fuse search in catalog order. */
export const searchEditorAssetsFn = (
	resources: ReadonlyArray<Project.Resource>,
	query: string,
): ReadonlyArray<Project.Resource> => {
	const fuzzyFn = createFuzzySearchFn({
		candidates: resources.map((resource) => ({
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
