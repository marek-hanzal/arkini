import { createFileRoute, useSearch } from "@tanstack/react-router";

import { EditorArtworkEdit } from "~/artwork-authoring/ui/EditorArtworkEdit";

export const Route = createFileRoute("/editor/$projectId/artwork/$resourceUid/edit")({
	component: () => {
		const { resourceUid } = Route.useParams();
		const search = useSearch({
			from: "/editor/$projectId/artwork",
		});
		return (
			<EditorArtworkEdit
				key={resourceUid}
				filter={search.filter ?? "all"}
				query={search.query ?? ""}
				resourceUid={resourceUid}
			/>
		);
	},
});
