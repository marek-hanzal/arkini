import { useMemo } from "react";

import type { Project } from "~/project-authoring/type/Project";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { readAssetCollectionFn } from "~/asset-authoring/fn/readAssetCollectionFn";
import type { AssetCollectionFilterSchema } from "~/asset-authoring/schema/AssetCollectionFilterSchema";

interface UseEditorAssetLibraryProps {
	readonly filter: AssetCollectionFilterSchema.Type;
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
	const resources = useMemo(
		() =>
			readAssetCollectionFn({
				config: project.config,
				filter,
				query,
				resources: project.resources,
			}),
		[
			filter,
			project.config,
			project.resources,
			query,
		],
	);

	return {
		empty: project.resources.length === 0,
		projectId: project.projectId,
		resources,
	};
};
