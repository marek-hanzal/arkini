import { useMemo } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { useEditorResourceUsages } from "~/bridge/resource/editor/useEditorResourceUsages";
import { useFuseSearch } from "~/ui/search/useFuseSearch";

export namespace useEditorAssetLibrary {
	export interface Options {
		readonly filter: "all" | "unused";
		readonly query: string;
	}
}

/** Projects the canonical resource catalog through its usage and fuzzy-search filters. */
export const useEditorAssetLibrary = ({ filter, query }: useEditorAssetLibrary.Options) => {
	const project = useEditorProject();
	const usages = useEditorResourceUsages();
	const usedResourceIds = useMemo(
		() => new Set(usages.map(({ resourceId }) => resourceId)),
		[
			usages,
		],
	);
	const candidates = useMemo(
		() =>
			project.resources
				.filter((resource) => filter === "all" || !usedResourceIds.has(resource.id))
				.map((resource) => ({
					identity: resource.id,
					terms: [
						resource.id,
						resource.mime,
						"PNG",
						"image",
					],
				})),
		[
			filter,
			project.resources,
			usedResourceIds,
		],
	);
	const matchingResourceIds = useFuseSearch(candidates, query);
	const resourcesById = useMemo(
		() =>
			new Map(
				project.resources.map((resource) => [
					resource.id,
					resource,
				]),
			),
		[
			project.resources,
		],
	);
	const resources = matchingResourceIds.flatMap((resourceId) => {
		const resource = resourcesById.get(resourceId);
		return resource === undefined
			? []
			: [
					resource,
				];
	});

	return {
		empty: project.resources.length === 0,
		project,
		resources,
	};
};
