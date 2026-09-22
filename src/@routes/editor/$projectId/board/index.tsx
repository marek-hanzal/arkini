import { createFileRoute } from "@tanstack/react-router";
import { PlayableBoard } from "~/game-shell/ui/PlayableBoard";

export const Route = createFileRoute("/editor/$projectId/board/")({
	component: () => <PlayableBoard cheatAlwaysAvailable />,
});
