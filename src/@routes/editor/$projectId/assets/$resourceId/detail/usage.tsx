import { createFileRoute } from "@tanstack/react-router";

import { EditorAssetUsage } from "~/asset-authoring/ui/EditorAssetUsage";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/detail/usage")({
	component: () => {
		const { resourceId } = Route.useParams();
		return <EditorAssetUsage resourceId={resourceId} />;
	},
});
