import { useMemo } from "react";

import type { Project } from "~/project-authoring/type/Project";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { searchEditorAssetsFn } from "~/asset-authoring/fn/searchEditorAssetsFn";
import { useEditorResourceUsages } from "~/asset-authoring/ui/useEditorResourceUsages";

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
	const resources = useMemo(
		() =>
			searchEditorAssetsFn(
				project.resources.filter(
					(resource) => filter === "all" || !usedResourceIds.has(resource.id),
				),
				query,
			),
		[
			filter,
			project.resources,
			query,
			usedResourceIds,
		],
	);

	return {
		empty: project.resources.length === 0,
		projectId: project.projectId,
		resources,
	};
};
