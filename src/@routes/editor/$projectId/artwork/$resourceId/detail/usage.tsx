import { createFileRoute } from "@tanstack/react-router";

import { EditorArtworkUsage } from "~/artwork-authoring/ui/EditorArtworkUsage";

export const Route = createFileRoute("/editor/$projectId/artwork/$resourceId/detail/usage")({
	component: () => {
		const { resourceId } = Route.useParams();
		return <EditorArtworkUsage resourceId={resourceId} />;
	},
});
