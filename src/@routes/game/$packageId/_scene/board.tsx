import { createFileRoute } from "@tanstack/react-router";
import { PlayableBoard } from "~/game-shell/ui/PlayableBoard";

export const Route = createFileRoute("/game/$packageId/_scene/board")({
	component: () => <PlayableBoard />,
});
