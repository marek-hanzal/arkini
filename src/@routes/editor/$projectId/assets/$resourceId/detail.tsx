import { createFileRoute, Outlet, useSearch } from "@tanstack/react-router";

import { EditorAssetDetailPage } from "~/page/editor/EditorAssetDetailPage";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/detail")({
	component: EditorAssetDetailRoute,
});

function EditorAssetDetailRoute() {
	const { resourceId } = Route.useParams();
	const search = useSearch({
		from: "/editor/$projectId/assets",
	});
	return (
		<EditorAssetDetailPage
			filter={search.filter ?? "all"}
			query={search.query ?? ""}
			resourceId={resourceId}
		>
			<Outlet />
		</EditorAssetDetailPage>
	);
}
