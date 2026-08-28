import { createFileRoute } from "@tanstack/react-router";

import { EditorAssetUsagePage } from "~/page/editor/EditorAssetUsagePage";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/detail/usage")({
	component: EditorAssetUsageRoute,
});

function EditorAssetUsageRoute() {
	const { resourceId } = Route.useParams();
	return <EditorAssetUsagePage resourceId={resourceId} />;
}
