import { createFileRoute } from "@tanstack/react-router";
import { TilePaintingDocumentPage } from "~/tile-painting/ui/TilePaintingDocumentPage";

export const Route = createFileRoute("/editor/$projectId/painter/$paintingId")({
	component: () => {
		const { projectId, paintingId } = Route.useParams();
		return (
			<TilePaintingDocumentPage
				key={`${projectId}:${paintingId}`}
				paintingId={paintingId}
			/>
		);
	},
});
