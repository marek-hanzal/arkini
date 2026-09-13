import { useProjectNotes } from "~/project-note/ui/useProjectNotes";
import { useMemo } from "react";

import type { Project } from "~/project-authoring/type/Project";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { readAssetCollectionFn } from "~/asset-authoring/fn/readAssetCollectionFn";
import type { AssetCatalogFilterSchema } from "~/asset-authoring/schema/AssetCatalogFilterSchema";

interface UseEditorAssetLibraryProps {
	readonly filter: AssetCatalogFilterSchema.Type;
	readonly query: string;
}

interface UseEditorAssetLibraryOutput {
	readonly empty: boolean;
	readonly notesLoading: boolean;
	readonly notesError?: unknown;
	readonly projectId: string;
	readonly projectRevision: number;
	readonly resources: ReadonlyArray<Project.Resource>;
}

/** Projects the canonical resource catalog through its usage and fuzzy-search filters. */
export const useEditorAssetLibrary = ({
	filter,
	query,
}: UseEditorAssetLibraryProps): UseEditorAssetLibraryOutput => {
	const project = useEditorProject();
	const notes = useProjectNotes(project.projectId);
	const notedResourceIds = useMemo(
		() => new Set(notes.notes.flatMap((note) => note.resourceIds)),
		[
			notes.notes,
		],
	);
	const resources = useMemo(
		() =>
			readAssetCollectionFn({
				config: project.config,
				filter: filter === "with-note" ? "all" : filter,
				query,
				resources:
					filter === "with-note"
						? project.resources.filter((resource) => notedResourceIds.has(resource.id))
						: project.resources,
			}),
		[
			notedResourceIds,
			filter,
			project.config,
			project.resources,
			query,
		],
	);

	return {
		empty: project.resources.length === 0,
		notesLoading: filter === "with-note" && notes.loading,
		notesError: filter === "with-note" ? notes.error : undefined,
		projectId: project.projectId,
		projectRevision: project.revision,
		resources,
	};
};
