import { useProjectNotes } from "~/project-note/ui/useProjectNotes";
import { useMemo } from "react";

import type { Project } from "~/project-authoring/type/Project";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { readArtworkCollectionFn } from "~/artwork-authoring/fn/readArtworkCollectionFn";
import type { ArtworkCatalogFilterSchema } from "~/artwork-authoring/schema/ArtworkCatalogFilterSchema";

interface UseEditorArtworkLibraryProps {
	readonly filter: ArtworkCatalogFilterSchema.Type;
	readonly query: string;
}

interface UseEditorArtworkLibraryOutput {
	readonly empty: boolean;
	readonly notesLoading: boolean;
	readonly notesError?: unknown;
	readonly projectId: string;
	readonly projectRevision: number;
	readonly resources: ReadonlyArray<Project.Resource>;
}

/** Projects the canonical resource catalog through its usage and fuzzy-search filters. */
export const useEditorArtworkLibrary = ({
	filter,
	query,
}: UseEditorArtworkLibraryProps): UseEditorArtworkLibraryOutput => {
	const project = useEditorProject();
	const notes = useProjectNotes(project.projectId);
	const notedResourceUids = useMemo(
		() => new Set(notes.notes.flatMap((note) => note.resourceUids)),
		[
			notes.notes,
		],
	);
	const resources = useMemo(
		() =>
			readArtworkCollectionFn({
				config: project.config,
				filter: filter === "with-note" ? "all" : filter,
				query,
				resources:
					filter === "with-note"
						? project.resources.filter((resource) =>
								notedResourceUids.has(resource.uid),
							)
						: project.resources,
			}),
		[
			notedResourceUids,
			filter,
			project.config,
			project.resources,
			query,
		],
	);

	return {
		empty: !project.resources.some(({ type }) => type === "artwork"),
		notesLoading: filter === "with-note" && notes.loading,
		notesError: filter === "with-note" ? notes.error : undefined,
		projectId: project.projectId,
		projectRevision: project.revision,
		resources,
	};
};
