import { createFileRoute } from "@tanstack/react-router";

import { EditorAssetOverviewPage } from "~/page/editor/EditorAssetOverviewPage";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/detail/overview")({
	component: EditorAssetOverviewRoute,
});

function EditorAssetOverviewRoute() {
	const { resourceId } = Route.useParams();
	return <EditorAssetOverviewPage resourceId={resourceId} />;
}
