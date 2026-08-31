import { useMemo } from "react";

import type { Project } from "~/project-authoring/type/Project";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useEditorResourceUsages } from "~/asset-authoring/ui/useEditorResourceUsages";
import { useFuseSearch } from "~/ui/ui/useFuseSearch";

interface UseEditorAssetLibraryProps {
	readonly filter: "all" | "unused";
	readonly query: string;
}

interface UseEditorAssetLibraryOutput {
	readonly empty: boolean;
	readonly projectId: string;
	readonly resources: ReadonlyArray<Project.Resource>;
}

/** Projects the canonical resource catalog through its usage and fuzzy-search filters. */
export const useEditorAssetLibrary = ({
	filter,
	query,
}: UseEditorAssetLibraryProps): UseEditorAssetLibraryOutput => {
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
	const resources = useMemo(
		() =>
			matchingResourceIds.flatMap((resourceId) => {
				const resource = resourcesById.get(resourceId);
				return resource === undefined
					? []
					: [
							resource,
						];
			}),
		[
			matchingResourceIds,
			resourcesById,
		],
	);

	return {
		empty: project.resources.length === 0,
		projectId: project.projectId,
		resources,
	};
};
