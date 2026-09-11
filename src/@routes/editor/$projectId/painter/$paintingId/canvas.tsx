import { createFileRoute } from "@tanstack/react-router";
import { TilePaintingCanvasPage } from "~/tile-painting/ui/TilePaintingCanvasPage";
export const Route = createFileRoute("/editor/$projectId/painter/$paintingId/canvas")({
	component: TilePaintingCanvasPage,
});
