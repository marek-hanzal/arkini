import { createFileRoute } from "@tanstack/react-router";

import { EditorArtworkUsage } from "~/artwork-authoring/ui/EditorArtworkUsage";

export const Route = createFileRoute("/editor/$projectId/artwork/$resourceUid/detail/usage")({
	component: () => {
		const { resourceUid } = Route.useParams();
		return <EditorArtworkUsage resourceUid={resourceUid} />;
	},
});
