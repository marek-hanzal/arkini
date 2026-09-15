import { createFileRoute, useSearch } from "@tanstack/react-router";

import { EditorArtworkEdit } from "~/artwork-authoring/ui/EditorArtworkEdit";

export const Route = createFileRoute("/editor/$projectId/artwork/$resourceId/edit")({
	component: () => {
		const { resourceId } = Route.useParams();
		const search = useSearch({
			from: "/editor/$projectId/artwork",
		});
		return (
			<EditorArtworkEdit
				key={resourceId}
				filter={search.filter ?? "all"}
				query={search.query ?? ""}
				resourceId={resourceId}
			/>
		);
	},
});
