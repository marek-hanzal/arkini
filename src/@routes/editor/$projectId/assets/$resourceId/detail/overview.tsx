import { createFileRoute } from "@tanstack/react-router";

import { EditorAssetOverview } from "~/ui/resource/editor/EditorAssetOverview";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/detail/overview")({
	component: EditorAssetOverviewRoute,
});

function EditorAssetOverviewRoute() {
	const { resourceId } = Route.useParams();
	return <EditorAssetOverview resourceId={resourceId} />;
}
