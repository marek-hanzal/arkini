import { createFileRoute } from "@tanstack/react-router";

import { EditorAssetOverview } from "~/asset-authoring/ui/EditorAssetOverview";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/detail/overview")({
	component: () => {
		const { resourceId } = Route.useParams();
		return <EditorAssetOverview resourceId={resourceId} />;
	},
});
