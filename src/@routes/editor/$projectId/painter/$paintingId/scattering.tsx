import { createFileRoute } from "@tanstack/react-router";
import { TilePaintingScattering } from "~/tile-painting/ui/TilePaintingScattering";
export const Route = createFileRoute("/editor/$projectId/painter/$paintingId/scattering")({
	component: TilePaintingScattering,
});
