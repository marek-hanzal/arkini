import { createFileRoute } from "@tanstack/react-router";

import { ProjectNotes } from "~/project-note/ui/ProjectNotes";
import { useProjectNotes } from "~/project-note/ui/useProjectNotes";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/detail/notes")({
	component: () => {
		const { projectId, resourceId } = Route.useParams();
		const search = Route.useSearch();
		const collection = useProjectNotes(projectId);
		return (
			<ProjectNotes
				key={resourceId}
				collection={collection}
				notes={collection.notes.filter((note) => note.resourceIds.includes(resourceId))}
				requiredCurrentResourceId={resourceId}
				defaultResourceIds={[
					resourceId,
				]}
				defaultItemUids={[]}
				assetFilter={search.filter}
				assetQuery={search.query}
			/>
		);
	},
});
