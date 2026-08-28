import { createFileRoute, useSearch } from "@tanstack/react-router";

import { EditorAssetDeleteSection } from "~/ui/resource/editor/EditorAssetDeleteSection";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/detail/delete")({
	component: () => {
		const { resourceId } = Route.useParams();
		const search = useSearch({
			from: "/editor/$projectId/assets",
		});
		return (
			<EditorAssetDeleteSection
				filter={search.filter ?? "all"}
				query={search.query ?? ""}
				resourceId={resourceId}
			/>
		);
	},
});
