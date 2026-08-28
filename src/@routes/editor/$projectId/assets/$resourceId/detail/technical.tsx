import { createFileRoute } from "@tanstack/react-router";

import { EditorAssetTechnicalPage } from "~/page/editor/EditorAssetTechnicalPage";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/detail/technical")({
	component: EditorAssetTechnicalRoute,
});

function EditorAssetTechnicalRoute() {
	const { resourceId } = Route.useParams();
	return <EditorAssetTechnicalPage resourceId={resourceId} />;
}
