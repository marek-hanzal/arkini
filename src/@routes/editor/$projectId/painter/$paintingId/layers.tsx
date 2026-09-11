import { createFileRoute } from "@tanstack/react-router";
import { TilePaintingLayers } from "~/tile-painting/ui/TilePaintingLayers";
export const Route = createFileRoute("/editor/$projectId/painter/$paintingId/layers")({
	component: TilePaintingLayers,
});
