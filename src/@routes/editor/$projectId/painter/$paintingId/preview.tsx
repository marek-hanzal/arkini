import { createFileRoute } from "@tanstack/react-router";
import { TilePaintingPreview } from "~/tile-painting/ui/TilePaintingPreview";
export const Route = createFileRoute("/editor/$projectId/painter/$paintingId/preview")({
	component: TilePaintingPreview,
});
