import { createFileRoute, useSearch } from "@tanstack/react-router";

import { EditorAssetEditPage } from "~/page/editor/EditorAssetEditPage";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/edit")({
	component: EditorAssetEditRoute,
});

function EditorAssetEditRoute() {
	const { resourceId } = Route.useParams();
	const search = useSearch({
		from: "/editor/$projectId/assets",
	});
	return (
		<EditorAssetEditPage
			key={resourceId}
			filter={search.filter ?? "all"}
			query={search.query ?? ""}
			resourceId={resourceId}
		/>
	);
}
