import { createFileRoute } from "@tanstack/react-router";
import { TilePaintingLibrary } from "~/tile-painting/ui/TilePaintingLibrary";
export const Route = createFileRoute("/editor/$projectId/painter/")({
	component: TilePaintingLibrary,
});
