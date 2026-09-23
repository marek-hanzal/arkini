import { createFileRoute } from "@tanstack/react-router";

import { ProjectNotes } from "~/project-note/ui/ProjectNotes";
import { useProjectNotes } from "~/project-note/ui/useProjectNotes";

export const Route = createFileRoute("/editor/$projectId/artwork/$resourceUid/detail/notes")({
	component: () => {
		const { projectId, resourceUid } = Route.useParams();
		const search = Route.useSearch();
		const collection = useProjectNotes(projectId);
		return (
			<ProjectNotes
				key={resourceUid}
				collection={collection}
				notes={collection.notes.filter((note) => note.resourceUids.includes(resourceUid))}
				requiredCurrentResourceUid={resourceUid}
				defaultResourceUids={[
					resourceUid,
				]}
				defaultItemUids={[]}
				artworkFilter={search.filter}
				artworkQuery={search.query}
			/>
		);
	},
});
