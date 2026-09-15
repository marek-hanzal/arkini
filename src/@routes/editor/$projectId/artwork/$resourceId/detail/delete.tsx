import { createFileRoute, useSearch } from "@tanstack/react-router";

import { EditorArtworkDeleteSection } from "~/artwork-authoring/ui/EditorArtworkDeleteSection";

export const Route = createFileRoute("/editor/$projectId/artwork/$resourceId/detail/delete")({
	component: () => {
		const { resourceId } = Route.useParams();
		const search = useSearch({
			from: "/editor/$projectId/artwork",
		});
		return (
			<EditorArtworkDeleteSection
				filter={search.filter ?? "all"}
				query={search.query ?? ""}
				resourceId={resourceId}
			/>
		);
	},
});
