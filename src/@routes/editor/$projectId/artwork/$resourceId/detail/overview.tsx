import { createFileRoute } from "@tanstack/react-router";

import { EditorArtworkOverview } from "~/artwork-authoring/ui/EditorArtworkOverview";

export const Route = createFileRoute("/editor/$projectId/artwork/$resourceId/detail/overview")({
	component: () => {
		const { resourceId } = Route.useParams();
		return <EditorArtworkOverview resourceId={resourceId} />;
	},
});
