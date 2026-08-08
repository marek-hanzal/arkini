import { createFileRoute } from "@tanstack/react-router";

import { EditorAssetUsage } from "~/ui/resource/editor/EditorAssetUsage";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/detail/usage")({
	component: EditorAssetUsageRoute,
});

function EditorAssetUsageRoute() {
	const { resourceId } = Route.useParams();
	return <EditorAssetUsage resourceId={resourceId} />;
}
