import { createFileRoute, useSearch } from "@tanstack/react-router";

import { EditorAssetDeletePage } from "~/page/editor/EditorAssetDeletePage";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/detail/delete")({
	component: EditorAssetDeleteRoute,
});

function EditorAssetDeleteRoute() {
	const { resourceId } = Route.useParams();
	const search = useSearch({
		from: "/editor/$projectId/assets",
	});
	return (
		<EditorAssetDeletePage
			filter={search.filter ?? "all"}
			query={search.query ?? ""}
			resourceId={resourceId}
		/>
	);
}
