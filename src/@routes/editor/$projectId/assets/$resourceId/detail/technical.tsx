import { createFileRoute } from "@tanstack/react-router";

import { EditorAssetTechnical } from "~/ui/resource/editor/EditorAssetTechnical";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/detail/technical")({
	component: () => {
		const { resourceId } = Route.useParams();
		return <EditorAssetTechnical resourceId={resourceId} />;
	},
});
