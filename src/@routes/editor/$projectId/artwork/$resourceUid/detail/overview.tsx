import { createFileRoute } from "@tanstack/react-router";

import { EditorArtworkOverview } from "~/artwork-authoring/ui/EditorArtworkOverview";

export const Route = createFileRoute("/editor/$projectId/artwork/$resourceUid/detail/overview")({
	component: () => {
		const { resourceUid } = Route.useParams();
		return <EditorArtworkOverview resourceUid={resourceUid} />;
	},
});
